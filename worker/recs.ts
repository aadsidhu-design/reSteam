import { type Route, json, route } from './util'

interface G { id: number; title: string; genre: string; tags: string; discount: number; owners: number }

/**
 * Content-based recommendations: the tags and genres of games you own (weighted by hours played), wishlist and follow
 * build a taste profile, and unowned published games are scored against it. Signed-out visitors get the popular games.
 */
export const recsRoutes: Route[] = [
  route('GET', '/recommendations', { auth: false }, async c => {
    const { results } = await c.env.DB.prepare(
      `SELECT g.id, g.title, g.genre, g.tags, g.discount, (SELECT COUNT(*) FROM library l WHERE l.game_id = g.id) AS owners FROM games g WHERE g.status = 'published'`,
    ).all<G>()
    const byId = new Map(results.map(g => [g.id, g]))
    const mine = new Map<number, number>() // game id -> weight from how much it is used
    const owned = new Set<number>()
    const ignored = new Set<number>()
    if (c.user) {
      const [lib, wish, fol, ign] = await c.env.DB.batch([
        c.env.DB.prepare('SELECT game_id, playtime, favorite FROM library WHERE user_id = ?').bind(c.user.id),
        c.env.DB.prepare('SELECT game_id FROM wishlist WHERE user_id = ?').bind(c.user.id),
        c.env.DB.prepare('SELECT game_id FROM followed WHERE user_id = ?').bind(c.user.id),
        c.env.DB.prepare('SELECT game_id FROM ignored WHERE user_id = ?').bind(c.user.id),
      ])
      for (const r of lib.results as { game_id: number; playtime: number; favorite: number }[]) { owned.add(r.game_id); mine.set(r.game_id, 1 + Math.min(r.playtime / 60, 10) + (r.favorite ? 2 : 0)) }
      for (const r of wish.results as { game_id: number }[]) mine.set(r.game_id, (mine.get(r.game_id) ?? 0) + 1.5)
      for (const r of fol.results as { game_id: number }[]) mine.set(r.game_id, (mine.get(r.game_id) ?? 0) + 1)
      for (const r of ign.results as { game_id: number }[]) ignored.add(r.game_id)
    }
    const taste = new Map<string, number>()
    for (const [id, w] of mine) {
      const g = byId.get(id); if (!g) continue
      for (const t of JSON.parse(g.tags) as string[]) taste.set(`t:${t}`, (taste.get(`t:${t}`) ?? 0) + w)
      for (const t of JSON.parse(g.genre) as string[]) taste.set(`g:${t}`, (taste.get(`g:${t}`) ?? 0) + w * 0.6)
    }
    const maxOwners = Math.max(1, ...results.map(g => g.owners))
    const scored = results.filter(g => !owned.has(g.id) && !ignored.has(g.id)).map(g => {
      let score = 0
      for (const t of JSON.parse(g.tags) as string[]) score += taste.get(`t:${t}`) ?? 0
      for (const t of JSON.parse(g.genre) as string[]) score += taste.get(`g:${t}`) ?? 0
      score += (g.owners / maxOwners) * 2 + g.discount / 60
      // explain the pick by the game you use most that shares the most with it
      let because: string | null = null, best = 0
      for (const [id, w] of mine) {
        const o = byId.get(id); if (!o || !owned.has(id)) continue
        const shared = (JSON.parse(o.tags) as string[]).filter(t => (JSON.parse(g.tags) as string[]).includes(t)).length
        if (shared > 0 && shared * w > best) { best = shared * w; because = o.title }
      }
      return { id: g.id, score: Math.round(score * 100) / 100, because }
    }).sort((a, b) => b.score - a.score || a.id - b.id).slice(0, 12)
    return json({ recommendations: scored, personal: taste.size > 0 }, 200, { 'cache-control': 'private, no-store' })
  }),
]
