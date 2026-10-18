import { type Ctx, type Env, type Route, cleanText, fail, hex, json, presenceOf, randomBytes, readJson, route, tooMany } from './util'

const DAY = 86_400_000
const MAX_FRIENDS = 250
const MAX_PENDING_OUT = 50
const MAX_GROUP = 20

interface UserRow { id: string; username: string; display_name: string; status: string; last_seen: number; playing_game: number | null; playing_at: number; privacy: string }

/** Pushes a realtime event to every open tab of a user (best effort; the database remains the source of truth). */
export async function push(env: Env, userId: string, event: unknown): Promise<void> {
  try { await env.USER_HUB.get(env.USER_HUB.idFromName(userId)).fetch('https://hub/push', { method: 'POST', body: JSON.stringify(event) }) } catch { /* no listeners */ }
}

export async function notify(env: Env, userId: string, kind: string, data: Record<string, unknown>): Promise<void> {
  const at = Date.now()
  const r = await env.DB.prepare('INSERT INTO notifications (user_id, kind, data, at) VALUES (?, ?, ?, ?)').bind(userId, kind, JSON.stringify(data), at).run()
  await push(env, userId, { type: 'notification', id: r.meta.last_row_id, kind, data, at })
}

export async function logEvent(env: Env, userId: string, kind: string, gameId: number | null, data: Record<string, unknown> = {}): Promise<void> {
  await env.DB.prepare('INSERT INTO events (user_id, kind, game_id, data, at) VALUES (?, ?, ?, ?, ?)').bind(userId, kind, gameId, JSON.stringify(data), Date.now()).run()
}

const byName = (env: Env, username: string) =>
  env.DB.prepare('SELECT id, username, display_name, status, last_seen, playing_game, playing_at, privacy FROM users WHERE username = ? COLLATE NOCASE').bind(username).first<UserRow>()

const blockedEither = async (env: Env, a: string, b: string) =>
  !!(await env.DB.prepare('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)').bind(a, b, b, a).first())

const relationTo = async (env: Env, me: string, other: string) =>
  (await env.DB.prepare('SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?').bind(me, other).first<{ status: string }>())?.status ?? null

/** Returns the other user only when they are an accepted friend and nobody has blocked anyone. */
async function friendOf(c: Ctx, username: string): Promise<UserRow | null> {
  const u = await byName(c.env, username)
  if (!u || u.id === c.user!.id) return null
  if ((await relationTo(c.env, c.user!.id, u.id)) !== 'accepted' || (await blockedEither(c.env, c.user!.id, u.id))) return null
  return u
}

const card = (u: Pick<UserRow, 'username' | 'display_name'>) => ({ username: u.username, name: u.display_name })
const sinceUsername = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 30) : '')

export const socialRoutes: Route[] = [
  // ---- friends ----
  route('GET', '/friends', {}, async c => {
    const me = c.user!.id, now = Date.now()
    const [rel, unread] = await c.env.DB.batch([
      c.env.DB.prepare(`SELECT u.username, u.display_name, u.status, u.last_seen, u.playing_game, u.playing_at, f.status AS rel, f.created_at
                        FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY u.username COLLATE NOCASE`).bind(me),
      c.env.DB.prepare('SELECT u.username, COUNT(*) AS n FROM dms d JOIN users u ON u.id = d.sender_id WHERE d.recipient_id = ? AND d.read_at IS NULL GROUP BY u.username').bind(me),
    ])
    const unreadBy = Object.fromEntries((unread.results as { username: string; n: number }[]).map(r => [r.username.toLowerCase(), r.n]))
    const rows = rel.results as (UserRow & { rel: string; created_at: number })[]
    return json({
      friends: rows.filter(r => r.rel === 'accepted').map(r => ({ ...card(r), presence: presenceOf(r, now), unread: unreadBy[r.username.toLowerCase()] ?? 0, since: r.created_at })),
      incoming: rows.filter(r => r.rel === 'pending_in').map(r => ({ ...card(r), at: r.created_at })),
      outgoing: rows.filter(r => r.rel === 'pending_out').map(r => ({ ...card(r), at: r.created_at })),
    })
  }),

  route('POST', '/friends/requests', {}, async c => {
    const b = await readJson<{ username: string }>(c.req)
    const target = await byName(c.env, sinceUsername(b.username))
    const me = c.user!.id
    // unknown users and users who blocked you look the same, so blocking cannot be probed
    if (!target || target.id === me || (await blockedEither(c.env, me, target.id))) return fail(404, 'No account with that name was found')
    const rel = await relationTo(c.env, me, target.id)
    if (rel === 'accepted') return fail(409, 'You are already friends')
    if (rel === 'pending_out') return fail(409, 'You already sent this person a request')
    if (rel === 'pending_in') return acceptWith(c, target) // they asked first, so this completes it
    const counts = await c.env.DB.prepare(`SELECT SUM(status = 'pending_out') AS out, SUM(status = 'accepted') AS friends FROM friendships WHERE user_id = ?`).bind(me).first<{ out: number | null; friends: number | null }>()
    if ((counts?.out ?? 0) >= MAX_PENDING_OUT) return fail(429, 'You have too many pending invites')
    if ((counts?.friends ?? 0) >= MAX_FRIENDS) return fail(429, 'Your friends list is full')
    const at = Date.now()
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending_out', ?)").bind(me, target.id, at),
      c.env.DB.prepare("INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?, ?, 'pending_in', ?)").bind(target.id, me, at),
    ])
    c.wait(notify(c.env, target.id, 'friend_request', { from: card(c.user!) }))
    return json({ ok: true, to: card(target) }, 201)
  }),

  route('POST', '/friends/requests/:username/accept', {}, async c => {
    const other = await byName(c.env, c.params.username)
    if (!other || (await relationTo(c.env, c.user!.id, other.id)) !== 'pending_in') return fail(404, 'No pending request from that person')
    return acceptWith(c, other)
  }),

  // decline an incoming request or cancel one you sent
  route('DELETE', '/friends/requests/:username', {}, async c => {
    const other = await byName(c.env, c.params.username)
    if (!other) return fail(404, 'No such request')
    const rel = await relationTo(c.env, c.user!.id, other.id)
    if (rel !== 'pending_in' && rel !== 'pending_out') return fail(404, 'No such request')
    await c.env.DB.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').bind(c.user!.id, other.id, other.id, c.user!.id).run()
    c.wait(push(c.env, other.id, { type: 'friends' }))
    return json({ ok: true })
  }),

  route('DELETE', '/friends/:username', {}, async c => {
    const other = await byName(c.env, c.params.username)
    if (!other || (await relationTo(c.env, c.user!.id, other.id)) !== 'accepted') return fail(404, 'That person is not your friend')
    await c.env.DB.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').bind(c.user!.id, other.id, other.id, c.user!.id).run()
    c.wait(push(c.env, other.id, { type: 'friends' }))
    return json({ ok: true })
  }),

  route('GET', '/blocks', {}, async c => {
    const { results } = await c.env.DB.prepare('SELECT u.username, u.display_name FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? ORDER BY u.username COLLATE NOCASE').bind(c.user!.id).all<UserRow>()
    return json({ blocked: results.map(card) })
  }),
  route('POST', '/blocks/:username', {}, async c => {
    const other = await byName(c.env, c.params.username)
    if (!other || other.id === c.user!.id) return fail(404, 'No account with that name was found')
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)').bind(c.user!.id, other.id, Date.now()),
      c.env.DB.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').bind(c.user!.id, other.id, other.id, c.user!.id),
    ])
    c.wait(push(c.env, other.id, { type: 'friends' }))
    return json({ ok: true })
  }),
  route('DELETE', '/blocks/:username', {}, async c => {
    const other = await byName(c.env, c.params.username)
    if (other) await c.env.DB.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?').bind(c.user!.id, other.id).run()
    return json({ ok: true })
  }),

  // ---- finding people and profiles ----
  route('GET', '/users/search', {}, async c => {
    // throttled separately so the endpoint cannot be used to scrape the user list
    if (!(await c.env.WRITE_LIMITER.limit({ key: `search:${c.user!.id}` })).success) return tooMany()
    const q = (c.url.searchParams.get('q') ?? '').trim().slice(0, 20).replace(/[\\%_]/g, m => `\\${m}`)
    if (q.length < 2) return json({ users: [] })
    const { results } = await c.env.DB.prepare(
      `SELECT u.username, u.display_name FROM users u WHERE u.username LIKE ? ESCAPE '\\' AND u.id != ?
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.user_id = u.id AND b.blocked_id = ?) ORDER BY u.username COLLATE NOCASE LIMIT 10`,
    ).bind(`${q}%`, c.user!.id, c.user!.id).all<UserRow>()
    return json({ users: results.map(card) })
  }),

  route('GET', '/users/:username', {}, async c => {
    const u = await byName(c.env, c.params.username)
    if (!u || (u.id !== c.user!.id && (await blockedEither(c.env, c.user!.id, u.id)))) return fail(404, 'No account with that name was found')
    const me = u.id === c.user!.id
    const rel = me ? 'self' : await relationTo(c.env, c.user!.id, u.id)
    const visible = me || u.privacy === 'public' || (u.privacy === 'friends' && rel === 'accepted')
    const base = { ...card(u), relation: rel, limited: !visible }
    if (!visible) return json(base)
    const [stats, recent, friends] = await c.env.DB.batch([
      c.env.DB.prepare('SELECT COUNT(*) AS owned, COALESCE(SUM(playtime), 0) AS minutes FROM library WHERE user_id = ?').bind(u.id),
      c.env.DB.prepare('SELECT game_id AS gameId, playtime, last_played AS lastPlayed FROM library WHERE user_id = ? AND last_played > 0 ORDER BY last_played DESC LIMIT 5').bind(u.id),
      c.env.DB.prepare("SELECT COUNT(*) AS n FROM friendships WHERE user_id = ? AND status = 'accepted'").bind(u.id),
    ])
    const s = stats.results[0] as { owned: number; minutes: number }
    return json({
      ...base, presence: presenceOf(u), gamesOwned: s.owned, minutes: s.minutes, level: Math.floor(s.owned * 1.5 + s.minutes / 120) + 1,
      friends: (friends.results[0] as { n: number }).n, recent: recent.results,
    })
  }),

  // ---- presence ----
  route('PUT', '/presence', {}, async c => {
    const b = await readJson<{ status: string }>(c.req)
    if (!['online', 'away', 'offline'].includes(String(b.status))) return fail(400, 'status must be online, away or offline')
    await c.env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(b.status, c.user!.id).run()
    return json({ ok: true })
  }),
  route('POST', '/presence/playing', {}, async c => {
    const b = await readJson<{ gameId: number | null }>(c.req)
    if (b.gameId === null || b.gameId === undefined) { await c.env.DB.prepare('UPDATE users SET playing_game = NULL WHERE id = ?').bind(c.user!.id).run(); return json({ ok: true }) }
    const id = Number(b.gameId)
    if (!Number.isInteger(id) || !(await c.env.DB.prepare('SELECT 1 FROM library WHERE user_id = ? AND game_id = ?').bind(c.user!.id, id).first())) return fail(403, 'not in your library')
    const wasPlaying = await c.env.DB.prepare('SELECT playing_game FROM users WHERE id = ?').bind(c.user!.id).first<{ playing_game: number | null }>()
    await c.env.DB.prepare('UPDATE users SET playing_game = ?, playing_at = ?, last_seen = ? WHERE id = ?').bind(id, Date.now(), Date.now(), c.user!.id).run()
    if (wasPlaying?.playing_game !== id) c.wait(logEvent(c.env, c.user!.id, 'playing', id))
    return json({ ok: true })
  }),
  route('POST', '/presence/ping', { write: false }, async c => {
    const now = Date.now()
    await c.env.DB.prepare('UPDATE users SET last_seen = ?, playing_at = CASE WHEN playing_game IS NULL THEN playing_at ELSE ? END WHERE id = ?').bind(now, now, c.user!.id).run()
    return json({ ok: true })
  }),

  // ---- direct messages ----
  route('GET', '/chats/:username', {}, async c => {
    const other = await friendOf(c, c.params.username)
    if (!other) return fail(404, 'That person is not your friend')
    const before = Number(c.url.searchParams.get('before') ?? 0) || Number.MAX_SAFE_INTEGER
    const { results } = await c.env.DB.prepare(
      `SELECT id, sender_id, text, at FROM dms WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)) AND id < ? ORDER BY id DESC LIMIT 60`,
    ).bind(c.user!.id, other.id, other.id, c.user!.id, before).all<{ id: number; sender_id: string; text: string; at: number }>()
    c.wait(c.env.DB.prepare('UPDATE dms SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL').bind(Date.now(), c.user!.id, other.id).run())
    return json({ messages: results.reverse().map(m => ({ id: m.id, from: m.sender_id === c.user!.id ? 'me' : other.username, text: m.text, at: m.at })) })
  }),

  route('POST', '/chats/:username', {}, async c => {
    const other = await friendOf(c, c.params.username)
    if (!other) return fail(404, 'That person is not your friend')
    const b = await readJson<{ text: string }>(c.req)
    const text = cleanText(b.text, 2000, true)
    if (!text) return fail(400, 'empty message')
    const at = Date.now()
    const r = await c.env.DB.prepare('INSERT INTO dms (sender_id, recipient_id, text, at) VALUES (?, ?, ?, ?)').bind(c.user!.id, other.id, text, at).run()
    const id = r.meta.last_row_id
    c.wait(push(c.env, other.id, { type: 'dm', id, from: c.user!.username, text, at }))
    c.wait(push(c.env, c.user!.id, { type: 'dm', id, from: 'me', with: other.username, text, at })) // other tabs of the sender
    return json({ message: { id, from: 'me', text, at } }, 201)
  }),

  route('POST', '/chats/:username/read', { write: false }, async c => {
    const other = await byName(c.env, c.params.username)
    if (other) await c.env.DB.prepare('UPDATE dms SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL').bind(Date.now(), c.user!.id, other.id).run()
    return json({ ok: true })
  }),

  // ---- group chats ----
  route('GET', '/groups', {}, async c => {
    const { results } = await c.env.DB.prepare(
      `SELECT g.id, g.name, g.owner_id = ? AS mine,
              (SELECT COUNT(*) FROM group_members m2 WHERE m2.group_id = g.id) AS members
       FROM chat_groups g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = ? ORDER BY g.created_at DESC`,
    ).bind(c.user!.id, c.user!.id).all()
    return json({ groups: results })
  }),

  route('POST', '/groups', {}, async c => {
    const b = await readJson<{ name: string; members: string[] }>(c.req)
    const name = cleanText(b.name, 40) || 'Group chat'
    const names = Array.isArray(b.members) ? [...new Set(b.members.map(sinceUsername).filter(Boolean))].slice(0, MAX_GROUP - 1) : []
    if (names.length === 0) return fail(400, 'pick at least one friend')
    const invited: UserRow[] = []
    for (const n of names) { const f = await friendOf(c, n); if (!f) return fail(400, `${n} is not your friend`); invited.push(f) }
    const id = hex(randomBytes(8)), at = Date.now()
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO chat_groups (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)').bind(id, name, c.user!.id, at),
      c.env.DB.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)').bind(id, c.user!.id, at),
      ...invited.map(u => c.env.DB.prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)').bind(id, u.id, at)),
    ])
    for (const u of invited) c.wait(notify(c.env, u.id, 'group_invite', { group: { id, name }, from: card(c.user!) }))
    return json({ group: { id, name, mine: 1, members: invited.length + 1 } }, 201)
  }),

  route('GET', '/groups/:id/messages', {}, async c => {
    if (!(await memberOf(c))) return fail(404, 'No such group')
    const before = Number(c.url.searchParams.get('before') ?? 0) || Number.MAX_SAFE_INTEGER
    const { results } = await c.env.DB.prepare(
      'SELECT m.id, u.username, m.text, m.at FROM group_messages m JOIN users u ON u.id = m.sender_id WHERE m.group_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT 60',
    ).bind(c.params.id, before).all<{ id: number; username: string; text: string; at: number }>()
    const members = await c.env.DB.prepare('SELECT u.username, u.display_name FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ?').bind(c.params.id).all<UserRow>()
    return json({ messages: results.reverse().map(m => ({ id: m.id, from: m.username === c.user!.username ? 'me' : m.username, text: m.text, at: m.at })), members: members.results.map(card) })
  }),

  route('POST', '/groups/:id/messages', {}, async c => {
    if (!(await memberOf(c))) return fail(404, 'No such group')
    const b = await readJson<{ text: string }>(c.req)
    const text = cleanText(b.text, 2000, true)
    if (!text) return fail(400, 'empty message')
    const at = Date.now()
    const r = await c.env.DB.prepare('INSERT INTO group_messages (group_id, sender_id, text, at) VALUES (?, ?, ?, ?)').bind(c.params.id, c.user!.id, text, at).run()
    const { results } = await c.env.DB.prepare('SELECT user_id FROM group_members WHERE group_id = ?').bind(c.params.id).all<{ user_id: string }>()
    for (const m of results) c.wait(push(c.env, m.user_id, { type: 'group-message', group: c.params.id, id: r.meta.last_row_id, from: m.user_id === c.user!.id ? 'me' : c.user!.username, text, at }))
    return json({ message: { id: r.meta.last_row_id, from: 'me', text, at } }, 201)
  }),

  route('POST', '/groups/:id/invite', {}, async c => {
    if (!(await memberOf(c))) return fail(404, 'No such group')
    const b = await readJson<{ username: string }>(c.req)
    const f = await friendOf(c, sinceUsername(b.username))
    if (!f) return fail(400, 'That person is not your friend')
    const size = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?').bind(c.params.id).first<{ n: number }>()
    if ((size?.n ?? 0) >= MAX_GROUP) return fail(429, 'This group is full')
    await c.env.DB.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)').bind(c.params.id, f.id, Date.now()).run()
    const g = await c.env.DB.prepare('SELECT name FROM chat_groups WHERE id = ?').bind(c.params.id).first<{ name: string }>()
    c.wait(notify(c.env, f.id, 'group_invite', { group: { id: c.params.id, name: g?.name ?? 'Group chat' }, from: card(c.user!) }))
    return json({ ok: true })
  }),

  route('POST', '/groups/:id/leave', {}, async c => {
    await c.env.DB.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').bind(c.params.id, c.user!.id).run()
    // an empty group disappears with its messages
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM group_messages WHERE group_id = ? AND NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = ?)').bind(c.params.id, c.params.id),
      c.env.DB.prepare('DELETE FROM chat_groups WHERE id = ? AND NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = ?)').bind(c.params.id, c.params.id),
    ])
    return json({ ok: true })
  }),

  // ---- notifications and activity ----
  route('GET', '/notifications', {}, async c => {
    const { results } = await c.env.DB.prepare('SELECT id, kind, data, at, read_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50').bind(c.user!.id).all<{ id: number; kind: string; data: string; at: number; read_at: number | null }>()
    return json({ notifications: results.map(n => ({ id: n.id, kind: n.kind, data: JSON.parse(n.data), at: n.at, read: n.read_at !== null })) })
  }),
  route('POST', '/notifications/read', {}, async c => {
    await c.env.DB.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').bind(Date.now(), c.user!.id).run()
    return json({ ok: true })
  }),

  route('GET', '/activity', {}, async c => {
    const { results } = await c.env.DB.prepare(
      `SELECT e.id, e.kind, e.game_id AS gameId, e.data, e.at, u.username, u.display_name
       FROM events e JOIN users u ON u.id = e.user_id
       WHERE e.at > ? AND (e.user_id = ? OR (u.privacy != 'private' AND e.user_id IN (SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted')))
       ORDER BY e.id DESC LIMIT 40`,
    ).bind(Date.now() - 14 * DAY, c.user!.id, c.user!.id).all<{ id: number; kind: string; gameId: number | null; data: string; at: number; username: string; display_name: string }>()
    return json({ events: results.map(e => ({ id: e.id, kind: e.kind, gameId: e.gameId, data: JSON.parse(e.data), at: e.at, user: e.username === c.user!.username ? 'me' : { username: e.username, name: e.display_name } })) })
  }),
]

async function memberOf(c: Ctx) {
  return !!(await c.env.DB.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').bind(c.params.id, c.user!.id).first())
}

async function acceptWith(c: Ctx, other: UserRow): Promise<Response> {
  const me = c.user!.id
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE friendships SET status = 'accepted', created_at = ? WHERE user_id = ? AND friend_id = ?").bind(Date.now(), me, other.id),
    c.env.DB.prepare("UPDATE friendships SET status = 'accepted', created_at = ? WHERE user_id = ? AND friend_id = ?").bind(Date.now(), other.id, me),
  ])
  c.wait(notify(c.env, other.id, 'friend_accepted', { from: card(c.user!) }))
  c.wait(push(c.env, me, { type: 'friends' }))
  c.wait(logEvent(c.env, me, 'friend', null, { with: card(other) }))
  return json({ ok: true, friend: card(other) })
}
