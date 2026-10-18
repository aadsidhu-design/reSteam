interface Limiter { limit(opts: { key: string }): Promise<{ success: boolean }> }

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  GENERAL_LIMITER: Limiter
  WRITE_LIMITER: Limiter
  NEW_USER_LIMITER: Limiter
}

const REPLIES = [
  'haha yeah', 'wait really?', 'lets play later tonight', 'brb 2 min', 'have you tried the new update?',
  'that sale is so good', 'one more round?', 'omg same', 'send me the link', 'gg',
]
const STARTER_GAME = 11
const STARTER_WALLET = 5000
const MAX_WALLET = 100_000
const STATUSES = ['online', 'away', 'offline']
const SESSION_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Public promo codes for the demo; each session can redeem each one once.
const PROMO_CODES: Record<string, { game?: number; credit?: number }> = {
  'RESTEAM-PAPER-LANTERNS': { game: 19 },
  'RESTEAM-WELCOME-10': { credit: 1000 },
}
const MAX_BODY_BYTES = 2048
const MAX_THREAD_MESSAGES = 200
const NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_ ]{1,19}$/
const PENDING_MS = 8000
const MAX_CUSTOM_FRIENDS = 25

const hueOf = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const fail = (status: number, error: string) => json({ error }, status)
const tooMany = () =>
  new Response(JSON.stringify({ error: 'too many requests, slow down' }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': '10' },
  })

const salePrice = (g: { price: number; discount: number }) => Math.round(g.price * (1 - g.discount / 100))

/** Returns false when a brand-new session is refused by the new-user limiter. */
async function ensureUser(env: Env, id: string, ip: string): Promise<boolean> {
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first()
  if (exists) return true
  // creating rows is the only unbounded write, so it gets its own strict per-IP limit
  if (!(await env.NEW_USER_LIMITER.limit({ key: ip })).success) return false
  const res = await env.DB.prepare('INSERT OR IGNORE INTO users (id, wallet, created_at) VALUES (?, ?, ?)')
    .bind(id, STARTER_WALLET, Date.now()).run()
  if (res.meta.changes > 0) {
    await env.DB.prepare('INSERT OR IGNORE INTO library (user_id, game_id) VALUES (?, ?)').bind(id, STARTER_GAME).run()
  }
  return true
}

async function me(env: Env, uid: string) {
  const [user, lib, wish, cart] = await env.DB.batch([
    env.DB.prepare('SELECT wallet, status, display_name FROM users WHERE id = ?').bind(uid),
    env.DB.prepare('SELECT game_id, installed, playtime, favorite, last_played FROM library WHERE user_id = ?').bind(uid),
    env.DB.prepare('SELECT game_id FROM wishlist WHERE user_id = ?').bind(uid),
    env.DB.prepare('SELECT game_id FROM cart WHERE user_id = ?').bind(uid),
  ])
  const u = user.results[0] as { wallet: number; status: string; display_name: string }
  const rows = lib.results as { game_id: number; installed: number; playtime: number; favorite: number; last_played: number }[]
  return {
    wallet: u.wallet,
    status: u.status,
    name: u.display_name,
    owned: rows.map(r => r.game_id),
    installed: rows.filter(r => r.installed).map(r => r.game_id),
    playtime: Object.fromEntries(rows.filter(r => r.playtime).map(r => [r.game_id, r.playtime])),
    favorites: rows.filter(r => r.favorite).map(r => r.game_id),
    lastPlayed: Object.fromEntries(rows.filter(r => r.last_played).map(r => [r.game_id, r.last_played])),
    wishlist: (wish.results as { game_id: number }[]).map(r => r.game_id),
    cart: (cart.results as { game_id: number }[]).map(r => r.game_id),
  }
}

async function gameExists(env: Env, id: number) {
  return !!(await env.DB.prepare('SELECT 1 FROM games WHERE id = ?').bind(id).first())
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

/** Reads a small JSON body; oversized or malformed bodies become an empty object so field checks reject them. */
async function readJson<T>(req: Request): Promise<Partial<T>> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'request body too large')
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, 'request body too large')
  try { return JSON.parse(text) as Partial<T> } catch { return {} }
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api/, '')
  const m = req.method

  if (path === '/health') return json({ ok: true })

  // browsers always send Origin on cross-site requests; refuse anything not from this site
  const origin = req.headers.get('origin')
  if (origin && origin !== url.origin) return fail(403, 'cross-origin requests are not allowed')

  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown'
  if (!(await env.GENERAL_LIMITER.limit({ key: ip })).success) return tooMany()

  if (path === '/games' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM games ORDER BY id').all<Record<string, unknown>>()
    return json(results.map(({ icon: _icon, size_gb, ...g }) => ({
      ...g, genre: JSON.parse(g.genre as string), tags: JSON.parse(g.tags as string), sizeGb: size_gb,
    })))
  }
  if (path === '/friends' && m === 'GET') {
    // custom friends are private to their owner; a pending request is accepted after a short delay
    const owner = SESSION_RE.test(req.headers.get('x-session') ?? '') ? req.headers.get('x-session')! : ''
    await env.DB.prepare("UPDATE friends SET status='online' WHERE status='pending' AND owner_id=? AND created_at < ?")
      .bind(owner, Date.now() - PENDING_MS).run()
    const { results } = await env.DB.prepare(
      'SELECT id, name, hue, status, game_id AS gameId, owner_id IS NOT NULL AS custom FROM friends WHERE owner_id IS NULL OR owner_id = ? ORDER BY id',
    ).bind(owner).all()
    return json(results.map(f => ({ ...f, gameId: f.gameId ?? undefined, custom: !!f.custom })))
  }

  // everything below is per-user; the session id is a client-generated UUID
  const uid = req.headers.get('x-session') ?? ''
  if (!SESSION_RE.test(uid)) return fail(401, 'missing or invalid X-Session header')
  if (m !== 'GET' && !(await env.WRITE_LIMITER.limit({ key: uid })).success) return tooMany()
  if (!(await ensureUser(env, uid, ip))) return tooMany()

  if (path === '/me' && m === 'GET') return json(await me(env, uid))

  let match: RegExpMatchArray | null
  if ((match = path.match(/^\/(cart|wishlist|installed|favorites)\/(\d+)$/))) {
    const [, kind, idStr] = match
    const id = Number(idStr)
    if (!(await gameExists(env, id))) return fail(404, 'no such game')
    if (kind === 'cart') {
      if (m === 'PUT') {
        const owned = await env.DB.prepare('SELECT 1 FROM library WHERE user_id=? AND game_id=?').bind(uid, id).first()
        if (owned) return fail(409, 'already owned')
        await env.DB.prepare('INSERT OR IGNORE INTO cart VALUES (?, ?)').bind(uid, id).run()
      } else if (m === 'DELETE') await env.DB.prepare('DELETE FROM cart WHERE user_id=? AND game_id=?').bind(uid, id).run()
      else return fail(405, 'method not allowed')
    } else if (kind === 'wishlist') {
      if (m === 'PUT') await env.DB.prepare('INSERT OR IGNORE INTO wishlist VALUES (?, ?)').bind(uid, id).run()
      else if (m === 'DELETE') await env.DB.prepare('DELETE FROM wishlist WHERE user_id=? AND game_id=?').bind(uid, id).run()
      else return fail(405, 'method not allowed')
    } else {
      const flag = m === 'PUT' ? 1 : m === 'DELETE' ? 0 : -1
      if (flag < 0) return fail(405, 'method not allowed')
      const column = kind === 'installed' ? 'installed' : 'favorite' // fixed literals, never user input
      const r = await env.DB.prepare(`UPDATE library SET ${column}=? WHERE user_id=? AND game_id=?`).bind(flag, uid, id).run()
      if (r.meta.changes === 0) return fail(403, 'not owned')
    }
    return json(await me(env, uid))
  }

  if (path === '/checkout' && m === 'POST') {
    const { results } = await env.DB.prepare(
      'SELECT g.id, g.price, g.discount FROM cart c JOIN games g ON g.id = c.game_id WHERE c.user_id = ?',
    ).bind(uid).all<{ id: number; price: number; discount: number }>()
    if (results.length === 0) return fail(400, 'cart is empty')
    const total = results.reduce((n, g) => n + salePrice(g), 0)
    // the wallet guard in the WHERE clause makes the debit atomic against concurrent checkouts
    const [debit] = await env.DB.batch([
      env.DB.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ? AND wallet >= ?').bind(total, uid, total),
    ])
    if (debit.meta.changes === 0) return fail(402, 'insufficient funds')
    await env.DB.batch([
      ...results.map(g => env.DB.prepare('INSERT OR IGNORE INTO library (user_id, game_id) VALUES (?, ?)').bind(uid, g.id)),
      env.DB.prepare('DELETE FROM wishlist WHERE user_id = ? AND game_id IN (SELECT game_id FROM cart WHERE user_id = ?)').bind(uid, uid),
      env.DB.prepare('DELETE FROM cart WHERE user_id = ?').bind(uid),
    ])
    return json(await me(env, uid))
  }

  if (path === '/wallet' && m === 'POST') {
    const body = await readJson<{ cents?: number }>(req)
    const cents = Number(body.cents)
    if (!Number.isInteger(cents) || cents <= 0 || cents > 10_000) return fail(400, 'cents must be 1..10000')
    await env.DB.prepare('UPDATE users SET wallet = MIN(wallet + ?, ?) WHERE id = ?').bind(cents, MAX_WALLET, uid).run()
    return json(await me(env, uid))
  }

  if ((match = path.match(/^\/claim\/(\d+)$/)) && m === 'POST') {
    const id = Number(match[1])
    const g = await env.DB.prepare('SELECT price, discount FROM games WHERE id = ?').bind(id).first<{ price: number; discount: number }>()
    if (!g) return fail(404, 'no such game')
    if (salePrice(g) !== 0) return fail(402, 'not free')
    await env.DB.prepare('INSERT OR IGNORE INTO library (user_id, game_id) VALUES (?, ?)').bind(uid, id).run()
    return json(await me(env, uid))
  }

  if ((match = path.match(/^\/playtime\/(\d+)$/)) && m === 'POST') {
    const body = await readJson<{ minutes?: number }>(req)
    const minutes = Number(body.minutes)
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 60) return fail(400, 'minutes must be 1..60')
    const r = await env.DB.prepare('UPDATE library SET playtime = playtime + ?, last_played = ? WHERE user_id=? AND game_id=? AND installed=1')
      .bind(minutes, Date.now(), uid, Number(match[1])).run()
    if (r.meta.changes === 0) return fail(403, 'not installed')
    return json(await me(env, uid))
  }

  if (path === '/friends' && m === 'POST') {
    const body = await readJson<{ name?: string }>(req)
    const name = (body.name ?? '').trim()
    if (!NAME_RE.test(name)) return fail(400, 'name must be 2-20 letters, numbers, spaces or underscores')
    const dupe = await env.DB.prepare('SELECT 1 FROM friends WHERE lower(name) = lower(?) AND (owner_id IS NULL OR owner_id = ?)').bind(name, uid).first()
    if (dupe) return fail(409, 'already your friend')
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM friends WHERE owner_id = ?').bind(uid).first<{ n: number }>()
    if ((count?.n ?? 0) >= MAX_CUSTOM_FRIENDS) return fail(429, 'friend limit reached')
    const id = `u${Date.now()}`
    await env.DB.prepare("INSERT INTO friends (id, name, hue, status, game_id, owner_id, created_at) VALUES (?, ?, ?, 'pending', NULL, ?, ?)")
      .bind(id, name, hueOf(name), uid, Date.now()).run()
    return json({ id, name, hue: hueOf(name), status: 'pending', custom: true }, 201)
  }

  if ((match = path.match(/^\/friends\/(u\d+)$/)) && m === 'DELETE') {
    const own = await env.DB.prepare('SELECT 1 FROM friends WHERE id = ? AND owner_id = ?').bind(match[1], uid).first()
    if (!own) return fail(404, 'no such friend')
    // messages reference the friend, so they must go first
    await env.DB.batch([
      env.DB.prepare('DELETE FROM messages WHERE friend_id = ?').bind(match[1]),
      env.DB.prepare('DELETE FROM friends WHERE id = ? AND owner_id = ?').bind(match[1], uid),
    ])
    return json({ ok: true })
  }

  if (path === '/redeem' && m === 'POST') {
    const body = await readJson<{ code?: string }>(req)
    const code = (body.code ?? '').trim().toUpperCase().slice(0, 40)
    const promo = PROMO_CODES[code]
    if (!promo) return fail(404, 'That product code is not valid')
    const claimed = await env.DB.prepare('INSERT OR IGNORE INTO redeemed (user_id, code, at) VALUES (?, ?, ?)').bind(uid, code, Date.now()).run()
    if (claimed.meta.changes === 0) return fail(409, 'You have already redeemed this code')
    if (promo.game) await env.DB.prepare('INSERT OR IGNORE INTO library (user_id, game_id) VALUES (?, ?)').bind(uid, promo.game).run()
    if (promo.credit) await env.DB.prepare('UPDATE users SET wallet = MIN(wallet + ?, ?) WHERE id = ?').bind(promo.credit, MAX_WALLET, uid).run()
    return json(await me(env, uid))
  }

  if (path === '/gift' && m === 'POST') {
    const body = await readJson<{ friendId?: string; cents?: number }>(req)
    const cents = Number(body.cents)
    if (!Number.isInteger(cents) || cents < 500 || cents > 10_000) return fail(400, 'gift amount must be between $5.00 and $100.00')
    const friend = await env.DB.prepare("SELECT id, name FROM friends WHERE id = ? AND status != 'pending' AND (owner_id IS NULL OR owner_id = ?)")
      .bind(String(body.friendId ?? ''), uid).first<{ id: string; name: string }>()
    if (!friend) return fail(404, 'no such friend')
    // same guarded debit as checkout, so concurrent gifts cannot overdraw the wallet
    const debit = await env.DB.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ? AND wallet >= ?').bind(cents, uid, cents).run()
    if (debit.meta.changes === 0) return fail(402, 'insufficient funds')
    await env.DB.prepare('INSERT INTO messages (user_id, friend_id, from_me, text, at) VALUES (?, ?, 1, ?, ?)')
      .bind(uid, friend.id, `Sent ${friend.name} a $${(cents / 100).toFixed(2)} gift card`, Date.now()).run()
    return json(await me(env, uid))
  }

  if (path === '/profile' && m === 'PUT') {
    const body = await readJson<{ name?: string }>(req)
    const name = (body.name ?? '').trim()
    if (!NAME_RE.test(name)) return fail(400, 'name must be 2-20 letters, numbers, spaces or underscores')
    await env.DB.prepare('UPDATE users SET display_name=? WHERE id=?').bind(name, uid).run()
    return json(await me(env, uid))
  }

  if (path === '/status' && m === 'PUT') {
    const body = await readJson<{ status?: string }>(req)
    if (!body.status || !STATUSES.includes(body.status)) return fail(400, `status must be one of ${STATUSES.join(', ')}`)
    await env.DB.prepare('UPDATE users SET status=? WHERE id=?').bind(body.status, uid).run()
    return json(await me(env, uid))
  }

  if ((match = path.match(/^\/chats\/([fu]\d+)$/))) {
    const fid = match[1]
    const friend = await env.DB.prepare('SELECT status FROM friends WHERE id = ? AND (owner_id IS NULL OR owner_id = ?)').bind(fid, uid).first<{ status: string }>()
    if (!friend) return fail(404, 'no such friend')
    if (friend.status === 'pending' && m === 'POST') return fail(409, 'friend request still pending')
    if (m === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT from_me AS fromMe, text, at FROM messages WHERE user_id=? AND friend_id=? ORDER BY id LIMIT 200',
      ).bind(uid, fid).all()
      return json(results.map(r => ({ from: r.fromMe ? 'me' : fid, text: r.text, at: r.at })))
    }
    if (m === 'POST') {
      const body = await readJson<{ text?: string }>(req)
      const text = (body.text ?? '').trim().slice(0, 500)
      if (!text) return fail(400, 'empty message')
      const now = Date.now()
      await env.DB.prepare('INSERT INTO messages (user_id, friend_id, from_me, text, at) VALUES (?, ?, 1, ?, ?)').bind(uid, fid, text, now).run()
      await env.DB.prepare(
        'DELETE FROM messages WHERE user_id=? AND friend_id=? AND id NOT IN (SELECT id FROM messages WHERE user_id=? AND friend_id=? ORDER BY id DESC LIMIT ?)',
      ).bind(uid, fid, uid, fid, MAX_THREAD_MESSAGES).run()
      if (friend.status === 'offline') return json({ reply: null })
      const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)]
      await env.DB.prepare('INSERT INTO messages (user_id, friend_id, from_me, text, at) VALUES (?, ?, 0, ?, ?)').bind(uid, fid, reply, now + 1).run()
      return json({ reply: { from: fid, text: reply, at: now + 1 } })
    }
  }

  return fail(404, 'not found')
}

const SECURITY_HEADERS: Record<string, string> = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
}

function hardened(res: Response): Response {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v)
  return out
}

export default {
  async fetch(req, env) {
    try {
      return hardened(await handle(req, env))
    } catch (e) {
      if (e instanceof HttpError) return hardened(fail(e.status, e.message))
      console.error(e)
      return hardened(fail(500, 'internal error'))
    }
  },
} satisfies ExportedHandler<Env>
