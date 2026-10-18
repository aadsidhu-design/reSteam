import { type Ctx, type Env, fail, fromHex, json, pbkdf2, randomBytes, readJson, route, safeEqual, sha256Hex, tooMany } from './util'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_MS = 30_000

function base32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

function unbase32(s: string): Uint8Array {
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of s.toUpperCase().replace(/=+$/, '')) {
    const i = B32.indexOf(ch)
    if (i < 0) continue
    value = (value << 5) | i; bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(out)
}

/** RFC 6238 code (HMAC-SHA1, 6 digits, 30 s steps) for a base32 secret at a given step. */
export async function totp(secret: string, step: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', unbase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const msg = new ArrayBuffer(8)
  const view = new DataView(msg)
  view.setUint32(0, Math.floor(step / 2 ** 32)); view.setUint32(4, step >>> 0)
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg))
  const o = h[h.length - 1] & 15
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, '0')
}

/** Accepts the current step and one either side (clock drift) but never a step that was already used. Returns the step or null. */
async function matchTotp(secret: string, code: string, lastStep: number, now = Date.now()): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null
  const cur = Math.floor(now / STEP_MS)
  for (const s of [cur, cur - 1, cur + 1]) {
    if (s > lastStep && safeEqual(new TextEncoder().encode(await totp(secret, s)), new TextEncoder().encode(code))) return s
  }
  return null
}

const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newBackupCode(): string {
  const chars = [...randomBytes(10)].map(x => BACKUP_ALPHABET[x % BACKUP_ALPHABET.length])
  return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`
}
const normBackup = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
const hashBackup = (userId: string, code: string) => sha256Hex(`${userId}:${normBackup(code)}`)

export async function recordEvent(c: Ctx, userId: string, kind: string) {
  const country = ((c.req as Request & { cf?: { country?: string } }).cf?.country ?? '').slice(0, 2) || null
  c.wait(c.env.DB.prepare('INSERT INTO login_events (user_id, at, kind, country, agent) VALUES (?, ?, ?, ?, ?)')
    .bind(userId, Date.now(), kind, country, (c.req.headers.get('user-agent') ?? '').slice(0, 120)).run())
}

type GuardRow = { totp_enabled: number; totp_secret: string | null; totp_step: number }

/** Checks an authenticator code or a one-time backup code for an account that has Guard on. */
export async function verifyGuard(env: Env, userId: string, u: GuardRow, code: unknown): Promise<boolean> {
  if (typeof code !== 'string' || code.length > 20) return false
  const trimmed = code.replace(/\s/g, '')
  if (/^\d{6}$/.test(trimmed) && u.totp_secret) {
    const step = await matchTotp(u.totp_secret, trimmed, u.totp_step)
    if (step === null) return false
    // the guard on totp_step makes a code usable once even across concurrent requests
    const r = await env.DB.prepare('UPDATE users SET totp_step = ? WHERE id = ? AND totp_step < ?').bind(step, userId, step).run()
    return r.meta.changes > 0
  }
  if (normBackup(trimmed).length === 10) {
    const r = await env.DB.prepare('UPDATE guard_backup SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL').bind(Date.now(), userId, await hashBackup(userId, trimmed)).run()
    return r.meta.changes > 0
  }
  return false
}

async function checkPassword(c: Ctx, password: unknown): Promise<boolean> {
  const row = await c.env.DB.prepare('SELECT pass_hash, pass_salt, pass_iters FROM users WHERE id = ?').bind(c.user!.id).first<{ pass_hash: string | null; pass_salt: string | null; pass_iters: number }>()
  if (typeof password !== 'string' || password.length > 128 || !row?.pass_hash || !row.pass_salt) return false
  return safeEqual(await pbkdf2(password, fromHex(row.pass_salt), row.pass_iters), fromHex(row.pass_hash))
}

const limit = async (c: Ctx, key: string) => !(await c.env.LOGIN_LIMITER.limit({ key })).success

export const guardRoutes = [
  route('GET', '/auth/guard', {}, async c => {
    const r = await c.env.DB.prepare('SELECT totp_enabled FROM users WHERE id = ?').bind(c.user!.id).first<{ totp_enabled: number }>()
    const left = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM guard_backup WHERE user_id = ? AND used_at IS NULL').bind(c.user!.id).first<{ n: number }>()
    return json({ enabled: !!r?.totp_enabled, backupCodesLeft: r?.totp_enabled ? left?.n ?? 0 : 0 })
  }),

  route('POST', '/auth/guard/setup', {}, async c => {
    const r = await c.env.DB.prepare('SELECT totp_enabled FROM users WHERE id = ?').bind(c.user!.id).first<{ totp_enabled: number }>()
    if (r?.totp_enabled) return fail(409, 'reGuard is already on')
    const secret = base32(randomBytes(20))
    await c.env.DB.prepare('UPDATE users SET totp_pending = ? WHERE id = ?').bind(secret, c.user!.id).run()
    const label = encodeURIComponent(`reSteam:${c.user!.username}`)
    return json({ secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=reSteam&algorithm=SHA1&digits=6&period=30` })
  }),

  route('POST', '/auth/guard/enable', {}, async c => {
    if (await limit(c, `guard:${c.user!.id}`)) return tooMany()
    const b = await readJson<{ code: string }>(c.req)
    const u = await c.env.DB.prepare('SELECT totp_pending, totp_enabled FROM users WHERE id = ?').bind(c.user!.id).first<{ totp_pending: string | null; totp_enabled: number }>()
    if (u?.totp_enabled) return fail(409, 'reGuard is already on')
    if (!u?.totp_pending) return fail(400, 'Start setup first')
    const step = typeof b.code === 'string' ? await matchTotp(u.totp_pending, b.code.replace(/\s/g, ''), 0) : null
    if (step === null) return fail(400, 'That code is not right. Check the time on your phone and try again.')
    const codes = Array.from({ length: 8 }, newBackupCode)
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = 1, totp_step = ? WHERE id = ?').bind(step, c.user!.id),
      c.env.DB.prepare('DELETE FROM guard_backup WHERE user_id = ?').bind(c.user!.id),
      ...await Promise.all(codes.map(async code => c.env.DB.prepare('INSERT INTO guard_backup (user_id, code_hash) VALUES (?, ?)').bind(c.user!.id, await hashBackup(c.user!.id, code)))),
    ])
    await recordEvent(c, c.user!.id, 'guard_on')
    return json({ ok: true, backupCodes: codes })
  }),

  route('POST', '/auth/guard/disable', {}, async c => {
    if (await limit(c, `guard:${c.user!.id}`)) return tooMany()
    const b = await readJson<{ password: string; code: string }>(c.req)
    const u = await c.env.DB.prepare('SELECT totp_enabled, totp_secret, totp_step FROM users WHERE id = ?').bind(c.user!.id).first<GuardRow>()
    if (!u?.totp_enabled) return fail(400, 'reGuard is not on')
    if (!(await checkPassword(c, b.password))) return fail(403, 'Your password is not correct')
    if (!(await verifyGuard(c.env, c.user!.id, u, b.code))) return fail(403, 'That code is not right')
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_enabled = 0, totp_step = 0 WHERE id = ?').bind(c.user!.id),
      c.env.DB.prepare('DELETE FROM guard_backup WHERE user_id = ?').bind(c.user!.id),
    ])
    await recordEvent(c, c.user!.id, 'guard_off')
    return json({ ok: true })
  }),

  // ---- devices ----
  route('GET', '/auth/sessions', {}, async c => {
    const { results } = await c.env.DB.prepare('SELECT id, created_at, last_seen, agent, country FROM sessions WHERE user_id = ? ORDER BY last_seen DESC').bind(c.user!.id).all<{ id: string; created_at: number; last_seen: number; agent: string | null; country: string | null }>()
    return json({ sessions: results.map(s => ({ id: s.id.slice(0, 16), current: s.id === c.user!.session, createdAt: s.created_at, lastSeen: s.last_seen, agent: s.agent ?? '', country: s.country })) })
  }),

  route('DELETE', '/auth/sessions/:sid', {}, async c => {
    if (!/^[0-9a-f]{16}$/.test(c.params.sid)) return fail(400, 'Bad session id')
    const r = await c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND substr(id, 1, 16) = ? AND id != ?").bind(c.user!.id, c.params.sid, c.user!.session).run()
    if (r.meta.changes === 0) return fail(404, 'No such device (you cannot sign out the one you are using here)')
    await recordEvent(c, c.user!.id, 'sessions_revoked')
    return json({ ok: true })
  }),

  route('POST', '/auth/sessions/revoke-others', {}, async c => {
    const r = await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(c.user!.id, c.user!.session).run()
    await recordEvent(c, c.user!.id, 'sessions_revoked')
    return json({ ok: true, revoked: r.meta.changes })
  }),

  route('GET', '/auth/events', {}, async c => {
    const { results } = await c.env.DB.prepare('SELECT kind, at, country, agent FROM login_events WHERE user_id = ? ORDER BY at DESC LIMIT 30').bind(c.user!.id).all()
    return json({ events: results })
  }),
]
