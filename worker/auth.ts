import { purgeUserGames } from './dev'
import {
  type AuthUser, type Ctx, type Env, type Route, USERNAME_RE, RESERVED,
  b64url, fail, fromHex, hex, json, pbkdf2, randomBytes, readJson, route, safeEqual, sha256Hex, tooMany,
} from './util'

export const SESSION_COOKIE = 'rs_session'
const DAY = 86_400_000
const STARTER_GAME = 11
const STARTER_WALLET = 5000
const MAX_SESSIONS = 10
const COMMON_PASSWORDS = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyui', 'qwerty123', 'iloveyou', 'letmein123', 'admin123', 'welcome1', 'abc12345', '11111111'])

const iterations = (env: Env) => Math.min(100_000, Math.max(10_000, Number(env.PBKDF2_ITERS) || 100_000))

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}

const cookieHeader = (value: string, secure: boolean, maxAgeSec?: number) =>
  `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}${maxAgeSec !== undefined ? `; Max-Age=${maxAgeSec}` : ''}`

export const publicUser = (u: { username: string; display_name: string; status: string; wallet: number; privacy: string }) =>
  ({ username: u.username, name: u.display_name, status: u.status, wallet: u.wallet, privacy: u.privacy })

/** Resolves the signed-in user from the session cookie, sliding the session and refreshing presence. */
export async function authenticate(req: Request, env: Env): Promise<AuthUser | null> {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token || token.length > 80) return null
  const id = await sha256Hex(token)
  const row = await env.DB.prepare(
    `SELECT s.id AS session, s.expires_at, s.last_seen AS s_seen, s.remember, u.id, u.username, u.display_name, u.status, u.wallet, u.privacy, u.last_seen
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  ).bind(id).first<AuthUser & { expires_at: number; s_seen: number; remember: number }>()
  if (!row) return null
  const now = Date.now()
  if (row.expires_at < now) { await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run(); return null }
  if (now - row.s_seen > 600_000) {
    await env.DB.prepare('UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id = ?').bind(now, now + (row.remember ? 30 : 1) * DAY, id).run()
  }
  if (now - row.last_seen > 20_000) await env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now, row.id).run()
  return { id: row.id, username: row.username, display_name: row.display_name, status: row.status, wallet: row.wallet, privacy: row.privacy, last_seen: now, session: id }
}

async function createSession(c: Ctx, userId: string, remember: boolean): Promise<string> {
  const token = b64url(randomBytes(32))
  const now = Date.now()
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen, remember, agent) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(await sha256Hex(token), userId, now, now + (remember ? 30 : 1) * DAY, now, remember ? 1 : 0, (c.req.headers.get('user-agent') ?? '').slice(0, 120)),
    // keep only the newest sessions per account
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id NOT IN (SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)').bind(userId, userId, MAX_SESSIONS),
  ])
  return cookieHeader(token, c.url.protocol === 'https:', remember ? 30 * 86_400 : undefined)
}

function validatePassword(password: unknown, username: string): string | null {
  if (typeof password !== 'string') return 'password is required'
  if (password.length < 8) return 'password must be at least 8 characters'
  if (password.length > 128) return 'password must be at most 128 characters'
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'that password is too common'
  if (username && password.toLowerCase().includes(username.toLowerCase())) return 'password must not contain your account name'
  if (/^(.)\1+$/.test(password)) return 'password must not be a single repeated character'
  return null
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newRecoveryCode(): string {
  const b = randomBytes(20)
  const chars = [...b].map(x => RECOVERY_ALPHABET[x % RECOVERY_ALPHABET.length])
  return [0, 5, 10, 15].map(i => chars.slice(i, i + 5).join('')).join('-')
}
const normalizeRecovery = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
async function hashRecovery(code: string, salt: string) { return sha256Hex(`${salt}:${normalizeRecovery(code)}`) }

async function verifyPassword(password: string, user: { pass_hash: string | null; pass_salt: string | null; pass_iters: number } | null, env: Env): Promise<boolean> {
  if (!user?.pass_hash || !user.pass_salt) {
    await pbkdf2(password, randomBytes(16), iterations(env)) // burn the same time so unknown names are not detectable by timing
    return false
  }
  return safeEqual(await pbkdf2(password, fromHex(user.pass_salt), user.pass_iters), fromHex(user.pass_hash))
}

async function limited(c: Ctx, kind: 'auth' | 'login', key: string) {
  const l = kind === 'auth' ? c.env.AUTH_LIMITER : c.env.LOGIN_LIMITER
  return !(await l.limit({ key })).success
}

type Creds = { username: string; password: string; remember: boolean; current: string; next: string; recoveryCode: string; newPassword: string }

export const authRoutes: Route[] = [
  route('POST', '/auth/register', { auth: false }, async c => {
    if (await limited(c, 'auth', `reg:${c.ip}`) || !(await c.env.NEW_USER_LIMITER.limit({ key: c.ip })).success) return tooMany()
    const b = await readJson<Creds>(c.req)
    const username = typeof b.username === 'string' ? b.username.trim() : ''
    if (!USERNAME_RE.test(username)) return fail(400, 'account name must be 3-20 letters, numbers or underscores')
    if (RESERVED.has(username.toLowerCase())) return fail(409, 'That account name is not available')
    const bad = validatePassword(b.password, username)
    if (bad) return fail(400, bad)
    if (await c.env.DB.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').bind(username).first()) return fail(409, 'That account name is not available')

    const id = crypto.randomUUID()
    const salt = randomBytes(16), iters = iterations(c.env)
    const hash = await pbkdf2(b.password as string, salt, iters)
    const code = newRecoveryCode()
    const rSalt = hex(randomBytes(16))
    const now = Date.now()
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(`INSERT INTO users (id, wallet, status, created_at, display_name, username, pass_hash, pass_salt, pass_iters, recovery_hash, recovery_salt, last_seen)
                          VALUES (?, ?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, STARTER_WALLET, now, username, username, hex(hash), hex(salt), iters, await hashRecovery(code, rSalt), rSalt, now),
        c.env.DB.prepare('INSERT INTO library (user_id, game_id) VALUES (?, ?)').bind(id, STARTER_GAME),
      ])
    } catch { return fail(409, 'That account name is not available') } // lost a race on the unique index
    const cookie = await createSession(c, id, b.remember !== false)
    return json({ user: publicUser({ username, display_name: username, status: 'online', wallet: STARTER_WALLET, privacy: 'public' }), recoveryCode: code }, 201, { 'set-cookie': cookie })
  }),

  route('POST', '/auth/login', { auth: false }, async c => {
    const b = await readJson<Creds>(c.req)
    const username = typeof b.username === 'string' ? b.username.trim().slice(0, 40) : ''
    if (await limited(c, 'auth', `ip:${c.ip}`) || await limited(c, 'login', `u:${username.toLowerCase()}`)) return tooMany()
    if (!username || typeof b.password !== 'string' || b.password.length > 128) return fail(401, 'Invalid account name or password')
    const u = await c.env.DB.prepare('SELECT id, username, display_name, status, wallet, privacy, pass_hash, pass_salt, pass_iters FROM users WHERE username = ? COLLATE NOCASE').bind(username).first<{
      id: string; username: string; display_name: string; status: string; wallet: number; privacy: string; pass_hash: string | null; pass_salt: string | null; pass_iters: number }>()
    if (!(await verifyPassword(b.password, u, c.env)) || !u) return fail(401, 'Invalid account name or password')
    const target = iterations(c.env)
    if (u.pass_iters < target) { // upgrade old hashes to the current cost while we have the password in hand
      const salt = randomBytes(16)
      c.wait(c.env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iters = ? WHERE id = ?').bind(hex(await pbkdf2(b.password, salt, target)), hex(salt), target, u.id).run())
    }
    const cookie = await createSession(c, u.id, b.remember !== false)
    return json({ user: publicUser(u) }, 200, { 'set-cookie': cookie })
  }),

  route('POST', '/auth/logout', { auth: false, write: false }, async c => {
    const token = readCookie(c.req, SESSION_COOKIE)
    if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run()
    return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', c.url.protocol === 'https:', 0) })
  }),

  route('GET', '/auth/me', {}, async c => json({ user: publicUser(c.user!) })),

  route('POST', '/auth/password', {}, async c => {
    const b = await readJson<Creds>(c.req)
    if (await limited(c, 'login', `pw:${c.user!.id}`)) return tooMany()
    const row = await c.env.DB.prepare('SELECT pass_hash, pass_salt, pass_iters FROM users WHERE id = ?').bind(c.user!.id).first<{ pass_hash: string | null; pass_salt: string | null; pass_iters: number }>()
    if (typeof b.current !== 'string' || !(await verifyPassword(b.current, row, c.env))) return fail(403, 'Your current password is not correct')
    const bad = validatePassword(b.next, c.user!.username)
    if (bad) return fail(400, bad)
    const salt = randomBytes(16), iters = iterations(c.env)
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iters = ? WHERE id = ?').bind(hex(await pbkdf2(b.next as string, salt, iters)), hex(salt), iters, c.user!.id),
      c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(c.user!.id, c.user!.session), // sign out everywhere else
    ])
    return json({ ok: true })
  }),

  route('POST', '/auth/recover', { auth: false }, async c => {
    const b = await readJson<Creds>(c.req)
    const username = typeof b.username === 'string' ? b.username.trim().slice(0, 40) : ''
    if (await limited(c, 'auth', `rec:${c.ip}`) || await limited(c, 'login', `rec:${username.toLowerCase()}`)) return tooMany()
    const u = await c.env.DB.prepare('SELECT id, username, display_name, status, wallet, privacy, recovery_hash, recovery_salt FROM users WHERE username = ? COLLATE NOCASE').bind(username).first<{
      id: string; username: string; display_name: string; status: string; wallet: number; privacy: string; recovery_hash: string | null; recovery_salt: string | null }>()
    const given = typeof b.recoveryCode === 'string' ? b.recoveryCode.slice(0, 40) : ''
    const ok = !!u?.recovery_hash && !!u.recovery_salt && safeEqual(fromHex(await hashRecovery(given, u.recovery_salt)), fromHex(u.recovery_hash))
    if (!ok || !u) return fail(401, 'The account name or recovery key is not correct')
    const bad = validatePassword(b.newPassword, u.username)
    if (bad) return fail(400, bad)
    const salt = randomBytes(16), iters = iterations(c.env), code = newRecoveryCode(), rSalt = hex(randomBytes(16))
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ?, pass_iters = ?, recovery_hash = ?, recovery_salt = ? WHERE id = ?')
        .bind(hex(await pbkdf2(b.newPassword as string, salt, iters)), hex(salt), iters, await hashRecovery(code, rSalt), rSalt, u.id),
      c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id),
    ])
    const cookie = await createSession(c, u.id, true)
    return json({ user: publicUser(u), recoveryCode: code }, 200, { 'set-cookie': cookie }) // the old key is now dead; show the new one once
  }),

  route('DELETE', '/auth/account', {}, async c => {
    const b = await readJson<Creds>(c.req)
    if (await limited(c, 'login', `del:${c.user!.id}`)) return tooMany()
    const row = await c.env.DB.prepare('SELECT pass_hash, pass_salt, pass_iters FROM users WHERE id = ?').bind(c.user!.id).first<{ pass_hash: string | null; pass_salt: string | null; pass_iters: number }>()
    if (typeof b.password !== 'string' || !(await verifyPassword(b.password, row, c.env))) return fail(403, 'Your password is not correct')
    const id = c.user!.id, db = c.env.DB
    await purgeUserGames(c.env, id)
    await db.batch([
      db.prepare('DELETE FROM review_votes WHERE user_id = ? OR review_id IN (SELECT id FROM reviews WHERE user_id = ?)').bind(id, id),
      db.prepare('DELETE FROM post_votes WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)').bind(id, id),
      db.prepare('DELETE FROM replies WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)').bind(id, id),
      db.prepare('DELETE FROM posts WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM reviews WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM reports WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM group_messages WHERE sender_id = ?').bind(id),
      db.prepare('DELETE FROM group_members WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM chat_groups WHERE owner_id = ? OR id NOT IN (SELECT group_id FROM group_members)').bind(id),
      db.prepare('DELETE FROM dms WHERE sender_id = ? OR recipient_id = ?').bind(id, id),
      db.prepare('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?').bind(id, id),
      db.prepare('DELETE FROM blocks WHERE user_id = ? OR blocked_id = ?').bind(id, id),
      db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM events WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM ignored WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM followed WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM redeemed WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM cart WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM wishlist WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM library WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM news_likes WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM news_comments WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM play_tokens WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM qr_logins WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
      db.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ])
    return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', c.url.protocol === 'https:', 0) })
  }),

  // ---- QR sign-in: the waiting browser shows a code, an already signed-in device approves it ----
  route('POST', '/auth/qr/begin', { auth: false }, async c => {
    if (await limited(c, 'auth', `qr:${c.ip}`)) return tooMany()
    const id = hex(randomBytes(16)), secret = b64url(randomBytes(24)), now = Date.now()
    c.wait(c.env.DB.prepare('DELETE FROM qr_logins WHERE expires_at < ?').bind(now - 600_000).run())
    await c.env.DB.prepare('INSERT INTO qr_logins (id, secret_hash, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(id, await sha256Hex(secret), now, now + 180_000).run()
    return json({ id, secret, expiresAt: now + 180_000 })
  }),

  route('POST', '/auth/qr/poll', { auth: false }, async c => {
    const b = await readJson<{ id: string; secret: string }>(c.req)
    if (typeof b.id !== 'string' || typeof b.secret !== 'string' || !/^[0-9a-f]{32}$/.test(b.id)) return fail(400, 'bad request')
    const row = await c.env.DB.prepare('SELECT secret_hash, status, user_id, expires_at FROM qr_logins WHERE id = ?').bind(b.id).first<{ secret_hash: string; status: string; user_id: string | null; expires_at: number }>()
    if (!row || !safeEqual(fromHex(await sha256Hex(b.secret)), fromHex(row.secret_hash))) return fail(404, 'unknown sign-in request')
    if (row.expires_at < Date.now() || row.status === 'used') return json({ status: 'expired' })
    if (row.status !== 'approved' || !row.user_id) return json({ status: 'pending' })
    // approved: consume exactly once, then give this browser its own session
    const used = await c.env.DB.prepare("UPDATE qr_logins SET status = 'used' WHERE id = ? AND status = 'approved'").bind(b.id).run()
    if (used.meta.changes === 0) return json({ status: 'expired' })
    const u = await c.env.DB.prepare('SELECT username, display_name, status, wallet, privacy FROM users WHERE id = ?').bind(row.user_id).first<{ username: string; display_name: string; status: string; wallet: number; privacy: string }>()
    if (!u) return json({ status: 'expired' })
    return json({ status: 'approved', user: publicUser(u) }, 200, { 'set-cookie': await createSession(c, row.user_id, true) })
  }),

  route('GET', '/auth/qr/:id', {}, async c => {
    const row = await c.env.DB.prepare('SELECT status, expires_at FROM qr_logins WHERE id = ?').bind(c.params.id).first<{ status: string; expires_at: number }>()
    if (!row || row.expires_at < Date.now() || row.status !== 'pending') return fail(404, 'This sign-in request has expired')
    return json({ valid: true, expiresAt: row.expires_at })
  }),

  route('POST', '/auth/qr/:id/approve', {}, async c => {
    const r = await c.env.DB.prepare("UPDATE qr_logins SET status = 'approved', user_id = ? WHERE id = ? AND status = 'pending' AND expires_at > ?").bind(c.user!.id, c.params.id, Date.now()).run()
    if (r.meta.changes === 0) return fail(404, 'This sign-in request has expired')
    return json({ ok: true })
  }),
]

