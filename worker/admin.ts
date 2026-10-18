import { type Ctx, type Route, cleanText, fail, json, readJson, route } from './util'
import { notify } from './social'

/** Moderators are the accounts listed in the ADMIN_USERNAMES variable (comma separated). Nobody is one by default. */
export const isAdmin = (c: Ctx) => !!c.user && (c.env.ADMIN_USERNAMES ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(c.user.username.toLowerCase())
const guard = (c: Ctx) => (isAdmin(c) ? null : fail(403, 'moderators only'))

export const adminRoutes: Route[] = [
  route('GET', '/admin/me', {}, async c => json({ admin: isAdmin(c), approvalRequired: c.env.REQUIRE_APPROVAL === '1' })),

  route('GET', '/admin/overview', {}, async c => {
    const denied = guard(c); if (denied) return denied
    const [reports, pending] = await c.env.DB.batch([
      c.env.DB.prepare(`SELECT r.id, r.target, r.reason, r.at, u.username AS reporter FROM reports r JOIN users u ON u.id = r.user_id ORDER BY r.at DESC LIMIT 100`),
      c.env.DB.prepare(`SELECT g.id, g.title, g.blurb, g.created_at AS at, u.username AS owner FROM games g JOIN users u ON u.id = g.owner_id WHERE g.status = 'pending' ORDER BY g.created_at`),
    ])
    return json({ reports: reports.results, pending: pending.results })
  }),

  route('POST', '/admin/reports/:id/dismiss', {}, async c => {
    const denied = guard(c); if (denied) return denied
    const r = await c.env.DB.prepare('DELETE FROM reports WHERE id = ?').bind(c.params.id).run()
    return r.meta.changes ? json({ ok: true }) : fail(404, 'no such report')
  }),

  route('POST', '/admin/games/:id/approve', {}, async c => {
    const denied = guard(c); if (denied) return denied
    const g = await c.env.DB.prepare("SELECT id, title, owner_id FROM games WHERE id = ? AND status = 'pending'").bind(c.params.id).first<{ id: number; title: string; owner_id: string }>()
    if (!g) return fail(404, 'no pending game with that id')
    await c.env.DB.prepare("UPDATE games SET status = 'published', released = CASE WHEN released = '' THEN ? ELSE released END WHERE id = ?").bind(new Date().toISOString().slice(0, 10), g.id).run()
    c.wait(notify(c.env, g.owner_id, 'game_approved', { gameId: g.id, title: g.title }))
    return json({ ok: true })
  }),

  /** Sends a game back to draft with a reason the owner sees (used to reject a submission or take a live game down). */
  route('POST', '/admin/games/:id/takedown', {}, async c => {
    const denied = guard(c); if (denied) return denied
    const b = await readJson<{ reason: string }>(c.req)
    const reason = cleanText(b.reason, 300)
    if (reason.length < 3) return fail(400, 'Give the owner a reason')
    const g = await c.env.DB.prepare("SELECT id, title, owner_id FROM games WHERE id = ? AND owner_id IS NOT NULL AND status IN ('published', 'pending')").bind(c.params.id).first<{ id: number; title: string; owner_id: string }>()
    if (!g) return fail(404, 'no such uploaded game')
    await c.env.DB.prepare("UPDATE games SET status = 'draft' WHERE id = ?").bind(g.id).run()
    c.wait(notify(c.env, g.owner_id, 'game_removed', { gameId: g.id, title: g.title, reason }))
    return json({ ok: true })
  }),
]
