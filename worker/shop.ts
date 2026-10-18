import { type Ctx, type Env, type Route, cleanText, fail, json, readJson, route } from './util'
import { logEvent, notify, push } from './social'
import { publicUser } from './auth'
import { shapeGame } from './dev'

const STARTER_GAME = 11
const MAX_WALLET = 100_000
// Public promo codes for the demo; each account can redeem each one once.
const PROMO_CODES: Record<string, { game?: number; credit?: number }> = {
  'RESTEAM-PAPER-LANTERNS': { game: 19 },
  'RESTEAM-WELCOME-10': { credit: 1000 },
}
export const salePrice = (g: { price: number; discount: number }) => Math.round(g.price * (1 - g.discount / 100))
const MINUTES_PER_ACHIEVEMENT = 3

const gameId = (c: Ctx) => Number(c.params.id)
const gameExists = async (c: Ctx) => Number.isInteger(gameId(c)) && !!(await c.env.DB.prepare("SELECT 1 FROM games WHERE id = ? AND (status = 'published' OR owner_id = ?)").bind(gameId(c), c.user?.id ?? '').first())

/** Everything the client needs about the signed-in account's store state, in one read. */
export async function me(env: Env, uid: string) {
  const [user, lib, wish, cart, ign, fol] = await env.DB.batch([
    env.DB.prepare('SELECT username, display_name, status, wallet, privacy FROM users WHERE id = ?').bind(uid),
    env.DB.prepare('SELECT game_id, installed, playtime, favorite, last_played FROM library WHERE user_id = ?').bind(uid),
    env.DB.prepare('SELECT game_id FROM wishlist WHERE user_id = ?').bind(uid),
    env.DB.prepare('SELECT game_id FROM cart WHERE user_id = ?').bind(uid),
    env.DB.prepare('SELECT game_id FROM ignored WHERE user_id = ?').bind(uid),
    env.DB.prepare('SELECT game_id FROM followed WHERE user_id = ?').bind(uid),
  ])
  const u = user.results[0] as { username: string; display_name: string; status: string; wallet: number; privacy: string }
  const rows = lib.results as { game_id: number; installed: number; playtime: number; favorite: number; last_played: number }[]
  const ids = (r: D1Result) => (r.results as { game_id: number }[]).map(x => x.game_id)
  return {
    ...publicUser(u),
    owned: rows.map(r => r.game_id),
    installed: rows.filter(r => r.installed).map(r => r.game_id),
    playtime: Object.fromEntries(rows.filter(r => r.playtime).map(r => [r.game_id, r.playtime])),
    favorites: rows.filter(r => r.favorite).map(r => r.game_id),
    lastPlayed: Object.fromEntries(rows.filter(r => r.last_played).map(r => [r.game_id, r.last_played])),
    wishlist: ids(wish), cart: ids(cart), ignored: ids(ign), followed: ids(fol),
  }
}

const REFUND_DAYS = 14
const REFUND_MINUTES = 120

/** Why a purchase can or cannot be refunded right now. */
async function refundCheck(c: Ctx): Promise<{ eligible: boolean; reason: string; cents: number; daysLeft: number; minutesPlayed: number }> {
  const row = await c.env.DB.prepare('SELECT acquired_at, paid, playtime FROM library WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).first<{ acquired_at: number; paid: number; playtime: number }>()
  const none = { eligible: false, cents: 0, daysLeft: 0, minutesPlayed: row?.playtime ?? 0 }
  if (!row) return { ...none, reason: 'You do not own this game' }
  if (row.paid <= 0 || row.acquired_at <= 0) return { ...none, reason: 'Only games you bought with wallet funds can be refunded' }
  const daysLeft = REFUND_DAYS - (Date.now() - row.acquired_at) / 86_400_000
  if (daysLeft <= 0) return { ...none, reason: `Refunds are only available within ${REFUND_DAYS} days of purchase` }
  if (row.playtime >= REFUND_MINUTES) return { ...none, reason: `Refunds are only available under ${REFUND_MINUTES / 60} hours of play time` }
  if (await c.env.DB.prepare('SELECT 1 FROM refunds WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).first()) return { ...none, reason: 'You have already refunded this game once' }
  const playing = await c.env.DB.prepare('SELECT 1 FROM users WHERE id = ? AND playing_game = ? AND playing_at > ?').bind(c.user!.id, gameId(c), Date.now() - 180_000).first()
  if (playing) return { ...none, reason: 'Close the game before requesting a refund' }
  return { eligible: true, reason: '', cents: row.paid, daysLeft: Math.ceil(daysLeft), minutesPlayed: row.playtime }
}

export const shopRoutes: Route[] = [
  route('GET', '/games', { auth: false }, async c => {
    // drafts are visible only to their author (through /dev/games)
    const { results } = await c.env.DB.prepare("SELECT g.*, u.username AS owner FROM games g LEFT JOIN users u ON u.id = g.owner_id WHERE g.status = 'published' ORDER BY g.id").all<Parameters<typeof shapeGame>[0]>()
    return json(results.map(shapeGame), 200, { 'cache-control': 'public, max-age=15' })
  }),

  route('GET', '/me', {}, async c => json(await me(c.env, c.user!.id))),

  // ---- lists: cart, wishlist, installed, favorites, ignored, followed ----
  route('PUT', '/cart/:id', {}, async c => {
    if (!(await gameExists(c))) return fail(404, 'no such game')
    if (await c.env.DB.prepare('SELECT 1 FROM library WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).first()) return fail(409, 'already owned')
    await c.env.DB.prepare('INSERT OR IGNORE INTO cart (user_id, game_id) VALUES (?, ?)').bind(c.user!.id, gameId(c)).run()
    return json(await me(c.env, c.user!.id))
  }),
  route('DELETE', '/cart/:id', {}, async c => { await c.env.DB.prepare('DELETE FROM cart WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).run(); return json(await me(c.env, c.user!.id)) }),

  route('PUT', '/wishlist/:id', {}, async c => {
    if (!(await gameExists(c))) return fail(404, 'no such game')
    await c.env.DB.prepare('INSERT OR IGNORE INTO wishlist (user_id, game_id) VALUES (?, ?)').bind(c.user!.id, gameId(c)).run()
    return json(await me(c.env, c.user!.id))
  }),
  route('DELETE', '/wishlist/:id', {}, async c => { await c.env.DB.prepare('DELETE FROM wishlist WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).run(); return json(await me(c.env, c.user!.id)) }),

  route('PUT', '/ignored/:id', {}, async c => {
    if (!(await gameExists(c))) return fail(404, 'no such game')
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT OR IGNORE INTO ignored (user_id, game_id) VALUES (?, ?)').bind(c.user!.id, gameId(c)),
      c.env.DB.prepare('DELETE FROM wishlist WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)), // an ignored game leaves your wishlist
    ])
    return json(await me(c.env, c.user!.id))
  }),
  route('DELETE', '/ignored/:id', {}, async c => { await c.env.DB.prepare('DELETE FROM ignored WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).run(); return json(await me(c.env, c.user!.id)) }),

  route('PUT', '/followed/:id', {}, async c => {
    if (!(await gameExists(c))) return fail(404, 'no such game')
    await c.env.DB.prepare('INSERT OR IGNORE INTO followed (user_id, game_id) VALUES (?, ?)').bind(c.user!.id, gameId(c)).run()
    return json(await me(c.env, c.user!.id))
  }),
  route('DELETE', '/followed/:id', {}, async c => { await c.env.DB.prepare('DELETE FROM followed WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).run(); return json(await me(c.env, c.user!.id)) }),

  route('PUT', '/installed/:id', {}, async c => setLibraryFlag(c, 'installed', 1)),
  route('DELETE', '/installed/:id', {}, async c => setLibraryFlag(c, 'installed', 0)),
  route('PUT', '/favorites/:id', {}, async c => setLibraryFlag(c, 'favorite', 1)),
  route('DELETE', '/favorites/:id', {}, async c => setLibraryFlag(c, 'favorite', 0)),

  // ---- money ----
  route('POST', '/checkout', {}, async c => {
    const { results } = await c.env.DB.prepare('SELECT g.id, g.price, g.discount FROM cart c JOIN games g ON g.id = c.game_id WHERE c.user_id = ?').bind(c.user!.id).all<{ id: number; price: number; discount: number }>()
    if (results.length === 0) return fail(400, 'cart is empty')
    const total = results.reduce((n, g) => n + salePrice(g), 0)
    // the guard in the WHERE clause makes the debit atomic against concurrent checkouts
    const debit = await c.env.DB.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ? AND wallet >= ?').bind(total, c.user!.id, total).run()
    if (debit.meta.changes === 0) return fail(402, 'insufficient funds')
    await c.env.DB.batch([
      ...results.map(g => c.env.DB.prepare('INSERT OR IGNORE INTO library (user_id, game_id, acquired_at, paid) VALUES (?, ?, ?, ?)').bind(c.user!.id, g.id, Date.now(), salePrice(g))),
      c.env.DB.prepare('DELETE FROM wishlist WHERE user_id = ? AND game_id IN (SELECT game_id FROM cart WHERE user_id = ?)').bind(c.user!.id, c.user!.id),
      c.env.DB.prepare('DELETE FROM cart WHERE user_id = ?').bind(c.user!.id),
    ])
    for (const g of results) c.wait(logEvent(c.env, c.user!.id, 'purchase', g.id))
    return json(await me(c.env, c.user!.id))
  }),

  route('POST', '/wallet', {}, async c => {
    const b = await readJson<{ cents: number }>(c.req)
    const cents = Number(b.cents)
    if (!Number.isInteger(cents) || cents <= 0 || cents > 10_000) return fail(400, 'cents must be 1..10000')
    await c.env.DB.prepare('UPDATE users SET wallet = MIN(wallet + ?, ?) WHERE id = ?').bind(cents, MAX_WALLET, c.user!.id).run()
    return json(await me(c.env, c.user!.id))
  }),

  route('POST', '/claim/:id', {}, async c => {
    const g = await c.env.DB.prepare('SELECT price, discount FROM games WHERE id = ?').bind(gameId(c)).first<{ price: number; discount: number }>()
    if (!g) return fail(404, 'no such game')
    if (salePrice(g) !== 0) return fail(402, 'not free')
    await c.env.DB.prepare('INSERT OR IGNORE INTO library (user_id, game_id) VALUES (?, ?)').bind(c.user!.id, gameId(c)).run()
    return json(await me(c.env, c.user!.id))
  }),

  // ---- refunds: within 14 days of buying and under 2 hours played, paid back into the wallet ----
  route('GET', '/refund/:id', {}, async c => json(await refundCheck(c))),
  route('POST', '/refund/:id', {}, async c => {
    const r = await refundCheck(c)
    if (!r.eligible) return fail(409, r.reason)
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM library WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)),
      c.env.DB.prepare('DELETE FROM cart WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)),
      c.env.DB.prepare('INSERT INTO refunds (user_id, game_id, cents, at) VALUES (?, ?, ?, ?)').bind(c.user!.id, gameId(c), r.cents, Date.now()),
      c.env.DB.prepare('UPDATE users SET wallet = wallet + ? WHERE id = ?').bind(r.cents, c.user!.id),
    ])
    return json(await me(c.env, c.user!.id))
  }),

  route('POST', '/redeem', {}, async c => {
    const b = await readJson<{ code: string }>(c.req)
    const code = cleanText(b.code, 40).toUpperCase()
    const promo = PROMO_CODES[code]
    if (!promo) return fail(404, 'That product code is not valid')
    const claimed = await c.env.DB.prepare('INSERT OR IGNORE INTO redeemed (user_id, code, at) VALUES (?, ?, ?)').bind(c.user!.id, code, Date.now()).run()
    if (claimed.meta.changes === 0) return fail(409, 'You have already redeemed this code')
    if (promo.game) await c.env.DB.prepare('INSERT OR IGNORE INTO library (user_id, game_id) VALUES (?, ?)').bind(c.user!.id, promo.game).run()
    if (promo.credit) await c.env.DB.prepare('UPDATE users SET wallet = MIN(wallet + ?, ?) WHERE id = ?').bind(promo.credit, MAX_WALLET, c.user!.id).run()
    return json(await me(c.env, c.user!.id))
  }),

  // a gift moves wallet funds from you to a friend
  route('POST', '/gift', {}, async c => {
    const b = await readJson<{ username: string; cents: number }>(c.req)
    const cents = Number(b.cents)
    if (!Number.isInteger(cents) || cents < 500 || cents > 10_000) return fail(400, 'gift amount must be between $5.00 and $100.00')
    const friend = await c.env.DB.prepare(
      `SELECT u.id, u.username FROM friendships f JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ? AND f.status = 'accepted' AND u.username = ? COLLATE NOCASE`,
    ).bind(c.user!.id, typeof b.username === 'string' ? b.username.slice(0, 20) : '').first<{ id: string; username: string }>()
    if (!friend) return fail(404, 'That person is not your friend')
    const debit = await c.env.DB.prepare('UPDATE users SET wallet = wallet - ? WHERE id = ? AND wallet >= ?').bind(cents, c.user!.id, cents).run()
    if (debit.meta.changes === 0) return fail(402, 'insufficient funds')
    const at = Date.now()
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET wallet = MIN(wallet + ?, ?) WHERE id = ?').bind(cents, MAX_WALLET, friend.id),
      c.env.DB.prepare('INSERT INTO dms (sender_id, recipient_id, text, at) VALUES (?, ?, ?, ?)').bind(c.user!.id, friend.id, `Sent you a $${(cents / 100).toFixed(2)} gift card`, at),
    ])
    c.wait(notify(c.env, friend.id, 'gift', { cents, from: { username: c.user!.username, name: c.user!.display_name } }))
    c.wait(push(c.env, friend.id, { type: 'dm', from: c.user!.username, text: `Sent you a $${(cents / 100).toFixed(2)} gift card`, at }))
    return json(await me(c.env, c.user!.id))
  }),

  // ---- playing ----
  route('POST', '/playtime/:id', {}, async c => {
    const b = await readJson<{ minutes: number }>(c.req)
    const minutes = Number(b.minutes)
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 60) return fail(400, 'minutes must be 1..60')
    const now = Date.now()
    // time only counts while the server knows you are actually playing this game
    const row = await c.env.DB.prepare(
      `SELECT l.playtime, g.achievements FROM library l JOIN games g ON g.id = l.game_id JOIN users u ON u.id = l.user_id
       WHERE l.user_id = ? AND l.game_id = ? AND l.installed = 1 AND u.playing_game = ? AND u.playing_at > ?`,
    ).bind(c.user!.id, gameId(c), gameId(c), now - 180_000).first<{ playtime: number; achievements: number }>()
    if (!row) return fail(403, 'you are not playing this game')
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE library SET playtime = playtime + ?, last_played = ? WHERE user_id = ? AND game_id = ?').bind(minutes, now, c.user!.id, gameId(c)),
      c.env.DB.prepare('UPDATE users SET playing_at = ?, last_seen = ? WHERE id = ?').bind(now, now, c.user!.id),
    ])
    const before = Math.min(row.achievements, Math.floor(row.playtime / MINUTES_PER_ACHIEVEMENT)), after = Math.min(row.achievements, Math.floor((row.playtime + minutes) / MINUTES_PER_ACHIEVEMENT))
    if (after > before) c.wait(logEvent(c.env, c.user!.id, 'achievement', gameId(c), { unlocked: after, total: row.achievements }))
    return json(await me(c.env, c.user!.id))
  }),

  // ---- profile ----
  route('PUT', '/profile', {}, async c => {
    const b = await readJson<{ name: string; privacy: string }>(c.req)
    if (b.name !== undefined) {
      const name = cleanText(b.name, 32)
      if (name.length < 2) return fail(400, 'display name must be 2-32 characters')
      await c.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(name, c.user!.id).run()
    }
    if (b.privacy !== undefined) {
      if (!['public', 'friends', 'private'].includes(b.privacy)) return fail(400, 'privacy must be public, friends or private')
      await c.env.DB.prepare('UPDATE users SET privacy = ? WHERE id = ?').bind(b.privacy, c.user!.id).run()
    }
    return json(await me(c.env, c.user!.id))
  }),
]

async function setLibraryFlag(c: Ctx, column: 'installed' | 'favorite', value: 0 | 1): Promise<Response> {
  // the column is one of two fixed literals, never user input
  const r = await c.env.DB.prepare(`UPDATE library SET ${column} = ? WHERE user_id = ? AND game_id = ?`).bind(value, c.user!.id, gameId(c)).run()
  if (r.meta.changes === 0) return fail(403, 'not owned')
  return json(await me(c.env, c.user!.id))
}

export { STARTER_GAME }
