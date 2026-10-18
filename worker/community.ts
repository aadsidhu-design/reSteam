import { type Ctx, type Route, cleanText, fail, json, readJson, route, tooMany } from './util'
import { logEvent, notify } from './social'

const DAY = 86_400_000
const HOUR = 3_600_000

const gameId = (c: Ctx) => Number(c.params.id)
const gameExists = async (c: Ctx) => Number.isInteger(gameId(c)) && !!(await c.env.DB.prepare("SELECT 1 FROM games WHERE id = ? AND (status = 'published' OR owner_id = ?)").bind(gameId(c), c.user?.id ?? '').first())
const owns = async (c: Ctx) => !!(await c.env.DB.prepare('SELECT 1 FROM library WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).first())

const reviewSelect = `
  SELECT r.id, r.game_id AS gameId, r.recommend, r.text, r.playtime, r.created_at AS at, u.username, u.display_name AS name,
    (SELECT COUNT(*) FROM review_votes v WHERE v.review_id = r.id AND v.kind = 'helpful') AS helpful,
    (SELECT COUNT(*) FROM review_votes v WHERE v.review_id = r.id AND v.kind = 'funny') AS funny,
    (SELECT group_concat(kind) FROM review_votes v WHERE v.review_id = r.id AND v.user_id = ?) AS mine
  FROM reviews r JOIN users u ON u.id = r.user_id`

interface ReviewRow { id: number; gameId: number; recommend: number; text: string; playtime: number; at: number; username: string; name: string; helpful: number; funny: number; mine: string | null }
const shapeReview = (r: ReviewRow) => ({ ...r, recommend: !!r.recommend, mine: r.mine ? r.mine.split(',') : [] })

const postSelect = `
  SELECT p.id, p.game_id AS gameId, p.kind, p.title, p.body, p.created_at AS at, u.username, u.display_name AS name,
    (SELECT COUNT(*) FROM replies x WHERE x.post_id = p.id) AS replies,
    (SELECT COUNT(*) FROM post_votes v WHERE v.post_id = p.id) AS votes,
    EXISTS (SELECT 1 FROM post_votes v WHERE v.post_id = p.id AND v.user_id = ?) AS mine
  FROM posts p JOIN users u ON u.id = p.user_id`

interface PostRow { id: number; gameId: number; kind: string; title: string; body: string; at: number; username: string; name: string; replies: number; votes: number; mine: number }
const shapePost = (p: PostRow) => ({ ...p, mine: !!p.mine })

async function report(c: Ctx, target: string): Promise<Response> {
  const b = await readJson<{ reason: string }>(c.req)
  const reason = cleanText(b.reason, 300) || 'no reason given'
  const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND at > ?').bind(c.user!.id, Date.now() - HOUR).first<{ n: number }>()
  if ((recent?.n ?? 0) >= 10) return tooMany()
  await c.env.DB.prepare('INSERT INTO reports (user_id, target, reason, at) VALUES (?, ?, ?, ?)').bind(c.user!.id, target, reason, Date.now()).run()
  return json({ ok: true })
}

export const communityRoutes: Route[] = [
  // ---- store-wide numbers, from real data only ----
  route('GET', '/stats', { auth: false }, async c => {
    const now = Date.now()
    const { results } = await c.env.DB.prepare(
      `SELECT g.id,
        (SELECT COUNT(*) FROM library l WHERE l.game_id = g.id) AS owners,
        (SELECT COUNT(*) FROM users u WHERE u.playing_game = g.id AND u.playing_at > ?) AS playing,
        (SELECT COUNT(*) FROM reviews r WHERE r.game_id = g.id) AS reviews,
        (SELECT COUNT(*) FROM reviews r WHERE r.game_id = g.id AND r.recommend = 1) AS positive,
        (SELECT COUNT(*) FROM posts p WHERE p.game_id = g.id AND p.created_at > ?) AS posts7d
       FROM games g`,
    ).bind(now - 120_000, now - 7 * DAY).all<{ id: number }>()
    return json({ stats: Object.fromEntries(results.map(r => [r.id, r])) }, 200, { 'cache-control': 'public, max-age=20' })
  }),

  // ---- charts: ranked lists built only from real activity, with movement from daily snapshots ----
  route('GET', '/charts', { auth: false }, async c => {
    const now = Date.now()
    const today = new Date(now).toISOString().slice(0, 10)
    const base = "FROM games g WHERE g.status = 'published'"
    const [sell, played, wished, fresh] = await c.env.DB.batch([
      c.env.DB.prepare(`SELECT g.id AS gameId, (SELECT COUNT(*) FROM library l WHERE l.game_id = g.id) AS value ${base} ORDER BY value DESC, g.id LIMIT 25`),
      c.env.DB.prepare(`SELECT g.id AS gameId, (SELECT COUNT(*) FROM users u WHERE u.playing_game = g.id AND u.playing_at > ?) AS value,
        (SELECT COALESCE(SUM(l.playtime), 0) FROM library l WHERE l.game_id = g.id) AS minutes ${base} ORDER BY value DESC, minutes DESC, g.id LIMIT 25`).bind(now - 120_000),
      c.env.DB.prepare(`SELECT g.id AS gameId, (SELECT COUNT(*) FROM wishlist w WHERE w.game_id = g.id) AS value ${base} ORDER BY value DESC, g.id LIMIT 25`),
      c.env.DB.prepare(`SELECT g.id AS gameId, g.released AS value ${base} AND g.released != '' ORDER BY g.released DESC, g.id DESC LIMIT 25`),
    ])
    const lists: Record<string, { gameId: number; value: number | string; minutes?: number }[]> = {
      topselling: sell.results as never, mostplayed: played.results as never, wishlisted: wished.results as never, new: fresh.results as never,
    }
    // record today's ranking once per chart, then compare with the most recent earlier day
    const writes = Object.entries(lists).flatMap(([kind, rows]) => rows.map((r, i) =>
      c.env.DB.prepare('INSERT OR IGNORE INTO chart_snapshots (day, kind, game_id, rank) VALUES (?, ?, ?, ?)').bind(today, kind, r.gameId, i + 1)))
    if (writes.length) await c.env.DB.batch(writes)
    const out: Record<string, unknown[]> = {}
    for (const [kind, rows] of Object.entries(lists)) {
      const prevDay = (await c.env.DB.prepare('SELECT MAX(day) AS d FROM chart_snapshots WHERE kind = ? AND day < ?').bind(kind, today).first<{ d: string | null }>())?.d ?? null
      const prev = prevDay ? new Map(((await c.env.DB.prepare('SELECT game_id, rank FROM chart_snapshots WHERE kind = ? AND day = ?').bind(kind, prevDay).all<{ game_id: number; rank: number }>()).results).map(r => [r.game_id, r.rank])) : null
      const weeks = new Map(((await c.env.DB.prepare(
        `SELECT game_id, COUNT(DISTINCT CAST(julianday(day) / 7 AS INTEGER)) AS w FROM chart_snapshots WHERE kind = ? GROUP BY game_id`).bind(kind).all<{ game_id: number; w: number }>()).results).map(r => [r.game_id, r.w]))
      out[kind] = rows.map((r, i) => ({ ...r, rank: i + 1, change: prev ? (prev.has(r.gameId) ? prev.get(r.gameId)! - (i + 1) : null) : null, isNew: prev ? !prev.has(r.gameId) : false, weeks: weeks.get(r.gameId) ?? 1 }))
    }
    return json(out, 200, { 'cache-control': 'public, max-age=20' })
  }),

  // ---- reviews ----
  route('GET', '/games/:id/reviews', { auth: false }, async c => {
    if (!(await gameExists(c))) return fail(404, 'no such game')
    const sort = c.url.searchParams.get('sort') === 'recent' ? 'r.created_at DESC' : 'helpful DESC, r.created_at DESC'
    const filter = c.url.searchParams.get('filter') === 'positive' ? 'AND r.recommend = 1' : c.url.searchParams.get('filter') === 'negative' ? 'AND r.recommend = 0' : ''
    const offset = Math.max(0, Number(c.url.searchParams.get('offset') ?? 0) || 0)
    const { results } = await c.env.DB.prepare(`${reviewSelect} WHERE r.game_id = ? ${filter} ORDER BY ${sort} LIMIT 20 OFFSET ?`).bind(c.user?.id ?? '', gameId(c), offset).all<ReviewRow>()
    return json({ reviews: results.map(shapeReview) })
  }),

  route('PUT', '/games/:id/review', {}, async c => {
    if (!(await gameExists(c))) return fail(404, 'no such game')
    if (!(await owns(c))) return fail(403, 'You can only review games you own')
    const b = await readJson<{ recommend: boolean; text: string }>(c.req, 20_000)
    const text = cleanText(b.text, 8000, true)
    if (typeof b.recommend !== 'boolean') return fail(400, 'say whether you recommend this game')
    if (text.length < 10) return fail(400, 'Please write at least a sentence about the game')
    const lib = await c.env.DB.prepare('SELECT playtime FROM library WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).first<{ playtime: number }>()
    const now = Date.now()
    const existed = await c.env.DB.prepare('SELECT id FROM reviews WHERE game_id = ? AND user_id = ?').bind(gameId(c), c.user!.id).first()
    await c.env.DB.prepare(
      `INSERT INTO reviews (game_id, user_id, recommend, text, playtime, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (game_id, user_id) DO UPDATE SET recommend = excluded.recommend, text = excluded.text, playtime = excluded.playtime, updated_at = excluded.updated_at`,
    ).bind(gameId(c), c.user!.id, b.recommend ? 1 : 0, text, lib?.playtime ?? 0, now, now).run()
    if (!existed) c.wait(logEvent(c.env, c.user!.id, 'review', gameId(c), { recommend: b.recommend }))
    return json({ ok: true })
  }),

  route('DELETE', '/games/:id/review', {}, async c => {
    const r = await c.env.DB.prepare('SELECT id FROM reviews WHERE game_id = ? AND user_id = ?').bind(gameId(c), c.user!.id).first<{ id: number }>()
    if (!r) return fail(404, 'You have not reviewed this game')
    await c.env.DB.batch([c.env.DB.prepare('DELETE FROM review_votes WHERE review_id = ?').bind(r.id), c.env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(r.id)])
    return json({ ok: true })
  }),

  route('POST', '/reviews/:id/vote', {}, async c => {
    const b = await readJson<{ kind: string }>(c.req)
    if (b.kind !== 'helpful' && b.kind !== 'funny') return fail(400, 'kind must be helpful or funny')
    const r = await c.env.DB.prepare('SELECT user_id, game_id FROM reviews WHERE id = ?').bind(c.params.id).first<{ user_id: string; game_id: number }>()
    if (!r) return fail(404, 'no such review')
    if (r.user_id === c.user!.id) return fail(403, 'You cannot vote on your own review')
    const had = await c.env.DB.prepare('SELECT 1 FROM review_votes WHERE review_id = ? AND user_id = ? AND kind = ?').bind(c.params.id, c.user!.id, b.kind).first()
    if (had) await c.env.DB.prepare('DELETE FROM review_votes WHERE review_id = ? AND user_id = ? AND kind = ?').bind(c.params.id, c.user!.id, b.kind).run()
    else {
      await c.env.DB.prepare('INSERT INTO review_votes (review_id, user_id, kind) VALUES (?, ?, ?)').bind(c.params.id, c.user!.id, b.kind).run()
      if (b.kind === 'helpful') c.wait(notify(c.env, r.user_id, 'review_helpful', { gameId: r.game_id, from: { username: c.user!.username, name: c.user!.display_name } }))
    }
    const n = await c.env.DB.prepare("SELECT SUM(kind = 'helpful') AS helpful, SUM(kind = 'funny') AS funny FROM review_votes WHERE review_id = ?").bind(c.params.id).first<{ helpful: number | null; funny: number | null }>()
    return json({ helpful: n?.helpful ?? 0, funny: n?.funny ?? 0, voted: !had })
  }),

  route('POST', '/reviews/:id/report', {}, c => report(c, `review:${c.params.id}`)),

  // ---- discussions and guides ----
  route('GET', '/games/:id/posts', { auth: false }, async c => {
    if (!(await gameExists(c))) return fail(404, 'no such game')
    const kind = c.url.searchParams.get('kind')
    const sort = c.url.searchParams.get('sort') === 'recent' ? 'p.created_at DESC' : 'votes DESC, p.created_at DESC'
    const { results } = await c.env.DB.prepare(`${postSelect} WHERE p.game_id = ? ${kind === 'discussion' || kind === 'guide' ? 'AND p.kind = ?' : ''} ORDER BY ${sort} LIMIT 40`)
      .bind(...[c.user?.id ?? '', gameId(c), ...(kind === 'discussion' || kind === 'guide' ? [kind] : [])]).all<PostRow>()
    return json({ posts: results.map(shapePost) })
  }),

  route('POST', '/games/:id/posts', {}, async c => {
    if (!(await gameExists(c))) return fail(404, 'no such game')
    const b = await readJson<{ kind: string; title: string; body: string }>(c.req, 20_000)
    if (b.kind !== 'discussion' && b.kind !== 'guide') return fail(400, 'kind must be discussion or guide')
    if (b.kind === 'guide' && !(await owns(c))) return fail(403, 'You can only write guides for games you own')
    const title = cleanText(b.title, 120), body = cleanText(b.body, 10_000, true)
    if (title.length < 3) return fail(400, 'Give your post a title')
    if (body.length < 10) return fail(400, 'Write a little more')
    const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND created_at > ?').bind(c.user!.id, Date.now() - HOUR).first<{ n: number }>()
    if ((recent?.n ?? 0) >= 5) return fail(429, 'You are posting too quickly. Try again later.')
    const r = await c.env.DB.prepare('INSERT INTO posts (game_id, user_id, kind, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(gameId(c), c.user!.id, b.kind, title, body, Date.now()).run()
    return json({ id: r.meta.last_row_id }, 201)
  }),

  route('GET', '/posts/:id', { auth: false }, async c => {
    const p = await c.env.DB.prepare(`${postSelect} WHERE p.id = ?`).bind(c.user?.id ?? '', c.params.id).first<PostRow>()
    if (!p) return fail(404, 'no such post')
    const { results } = await c.env.DB.prepare(
      'SELECT x.id, x.body, x.created_at AS at, u.username, u.display_name AS name FROM replies x JOIN users u ON u.id = x.user_id WHERE x.post_id = ? ORDER BY x.id LIMIT 200',
    ).bind(c.params.id).all()
    return json({ post: shapePost(p), replies: results })
  }),

  route('POST', '/posts/:id/replies', {}, async c => {
    const p = await c.env.DB.prepare('SELECT user_id, title, game_id FROM posts WHERE id = ?').bind(c.params.id).first<{ user_id: string; title: string; game_id: number }>()
    if (!p) return fail(404, 'no such post')
    const b = await readJson<{ body: string }>(c.req)
    const body = cleanText(b.body, 5000, true)
    if (!body) return fail(400, 'empty reply')
    const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM replies WHERE user_id = ? AND created_at > ?').bind(c.user!.id, Date.now() - HOUR).first<{ n: number }>()
    if ((recent?.n ?? 0) >= 30) return fail(429, 'You are replying too quickly. Try again later.')
    const r = await c.env.DB.prepare('INSERT INTO replies (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)').bind(c.params.id, c.user!.id, body, Date.now()).run()
    if (p.user_id !== c.user!.id) c.wait(notify(c.env, p.user_id, 'post_reply', { postId: Number(c.params.id), title: p.title, gameId: p.game_id, from: { username: c.user!.username, name: c.user!.display_name } }))
    return json({ id: r.meta.last_row_id }, 201)
  }),

  route('POST', '/posts/:id/vote', {}, async c => {
    const p = await c.env.DB.prepare('SELECT user_id FROM posts WHERE id = ?').bind(c.params.id).first<{ user_id: string }>()
    if (!p) return fail(404, 'no such post')
    if (p.user_id === c.user!.id) return fail(403, 'You cannot vote on your own post')
    const had = await c.env.DB.prepare('SELECT 1 FROM post_votes WHERE post_id = ? AND user_id = ?').bind(c.params.id, c.user!.id).first()
    await (had
      ? c.env.DB.prepare('DELETE FROM post_votes WHERE post_id = ? AND user_id = ?')
      : c.env.DB.prepare('INSERT INTO post_votes (post_id, user_id) VALUES (?, ?)')).bind(c.params.id, c.user!.id).run()
    const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM post_votes WHERE post_id = ?').bind(c.params.id).first<{ n: number }>()
    return json({ votes: n?.n ?? 0, voted: !had })
  }),

  route('DELETE', '/posts/:id', {}, async c => {
    const r = await c.env.DB.prepare('SELECT 1 FROM posts WHERE id = ? AND user_id = ?').bind(c.params.id, c.user!.id).first()
    if (!r) return fail(404, 'no such post')
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM post_votes WHERE post_id = ?').bind(c.params.id),
      c.env.DB.prepare('DELETE FROM replies WHERE post_id = ?').bind(c.params.id),
      c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(c.params.id),
    ])
    return json({ ok: true })
  }),
  route('DELETE', '/replies/:id', {}, async c => {
    const r = await c.env.DB.prepare('DELETE FROM replies WHERE id = ? AND user_id = ?').bind(c.params.id, c.user!.id).run()
    return r.meta.changes ? json({ ok: true }) : fail(404, 'no such reply')
  }),
  route('POST', '/posts/:id/report', {}, c => report(c, `post:${c.params.id}`)),
  route('POST', '/replies/:id/report', {}, c => report(c, `reply:${c.params.id}`)),

  // ---- community front page: newest and most-voted content across every game ----
  route('GET', '/community/feed', { auth: false }, async c => {
    const sort = c.url.searchParams.get('sort') === 'recent' ? 'recent' : 'popular'
    const [rv, ps] = await c.env.DB.batch([
      c.env.DB.prepare(`${reviewSelect} ORDER BY ${sort === 'recent' ? 'r.created_at' : 'helpful'} DESC, r.created_at DESC LIMIT 20`).bind(c.user?.id ?? ''),
      c.env.DB.prepare(`${postSelect} ORDER BY ${sort === 'recent' ? 'p.created_at' : 'votes'} DESC, p.created_at DESC LIMIT 30`).bind(c.user?.id ?? ''),
    ])
    const items = [
      ...(rv.results as ReviewRow[]).map(r => ({ type: 'review' as const, at: r.at, score: r.helpful, item: shapeReview(r) })),
      ...(ps.results as PostRow[]).map(p => ({ type: p.kind as 'discussion' | 'guide', at: p.at, score: p.votes + p.replies, item: shapePost(p) })),
    ].sort((a, b) => (sort === 'recent' ? b.at - a.at : b.score - a.score || b.at - a.at))
    return json({ items })
  }),

  route('GET', '/community/hubs', { auth: false }, async c => {
    const now = Date.now()
    const { results } = await c.env.DB.prepare(
      `SELECT g.id AS gameId,
        (SELECT COUNT(*) FROM posts p WHERE p.game_id = g.id AND p.created_at > ?) AS posts,
        (SELECT COUNT(*) FROM posts p WHERE p.game_id = g.id AND p.kind = 'guide' AND p.created_at > ?) AS guides,
        (SELECT COUNT(*) FROM reviews r WHERE r.game_id = g.id AND r.created_at > ?) AS reviews,
        (SELECT COUNT(*) FROM users u WHERE u.playing_game = g.id AND u.playing_at > ?) AS playing,
        (SELECT COUNT(*) FROM library l WHERE l.game_id = g.id) AS owners
       FROM games g ORDER BY (posts + reviews + playing * 2) DESC, owners DESC LIMIT 6`,
    ).bind(now - 7 * DAY, now - 7 * DAY, now - 7 * DAY, now - 120_000).all()
    return json({ hubs: results }, 200, { 'cache-control': 'public, max-age=20' })
  }),
]
