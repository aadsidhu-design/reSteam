import { unzipSync } from 'fflate'
import { type Ctx, type Env, type Route, b64url, cleanText, fail, json, randomBytes, readJson, route, sha256Hex, tooMany } from './util'
import { logEvent } from './social'

// Limits are deliberately small: this runs on a free-plan Worker and anyone can sign up.
const MAX_GAMES_PER_USER = 10
const MAX_CREATES_PER_HOUR = 5
const MAX_COVER = 2 * 1024 * 1024
const MAX_BUILD = 50 * 1024 * 1024
const MAX_ZIP = 15 * 1024 * 1024
const MAX_WEB_TOTAL = 40 * 1024 * 1024
const MAX_WEB_FILE = 20 * 1024 * 1024
const MAX_WEB_FILES = 300
const MAX_PRICE = 10_000
const GENRES = ['Action', 'Adventure', 'Casual', 'Co-op', 'Horror', 'Indie', 'Party', 'Platformer', 'Puzzle', 'Racing', 'RPG', 'Shooter', 'Simulation', 'Space', 'Sports', 'Strategy', 'Survival']
const HOUR = 3_600_000

const gameId = (c: Ctx) => Number(c.params.id)

interface GameRow {
  id: number; title: string; dev: string; genre: string; tags: string; price: number; discount: number; blurb: string; hue: number; motif: string
  owner_id: string | null; status: string; has_cover: number; web_entry: string | null; build_name: string | null; build_size: number; created_at: number
  released: string; publisher: string; achievements: number; size_gb: number
}

/** The shape every client sees for any game (catalog and uploaded alike). */
export function shapeGame(g: GameRow & { owner?: string | null }) {
  return {
    id: g.id, title: g.title, dev: g.dev, publisher: g.publisher, genre: JSON.parse(g.genre), tags: JSON.parse(g.tags), price: g.price, discount: g.discount,
    released: g.released, blurb: g.blurb, hue: g.hue, motif: g.motif, achievements: g.achievements, sizeGb: g.size_gb,
    user: g.owner_id !== null, owner: g.owner ?? null, hasCover: !!g.has_cover, playable: !!g.web_entry,
    build: g.build_name ? { name: g.build_name, size: g.build_size } : null, status: g.status,
  }
}

const SELECT = 'SELECT g.*, u.username AS owner FROM games g LEFT JOIN users u ON u.id = g.owner_id'

async function ownedGame(c: Ctx): Promise<GameRow | null> {
  return c.env.DB.prepare('SELECT * FROM games WHERE id = ? AND owner_id = ?').bind(gameId(c), c.user!.id).first<GameRow>()
}

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', wasm: 'application/wasm',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8', xml: 'application/xml', glb: 'model/gltf-binary', gltf: 'model/gltf+json',
}
const extOf = (p: string) => p.slice(p.lastIndexOf('.') + 1).toLowerCase()

/** Detects the image type from its first bytes so a "cover" can never be a script. */
function imageType(b: Uint8Array): string | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp'
  return null
}

const safeName = (s: string) => s.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/^\.+/, '').slice(0, 80) || 'download'

async function deletePrefix(env: Env, prefix: string) {
  let cursor: string | undefined
  do {
    const l = await env.FILES.list({ prefix, cursor, limit: 500 })
    if (l.objects.length) await env.FILES.delete(l.objects.map(o => o.key))
    cursor = l.truncated ? l.cursor : undefined
  } while (cursor)
}

/** Every row that points at a game, in delete order. */
function purgeStatements(env: Env, id: number) {
  const db = env.DB
  return [
    db.prepare('DELETE FROM review_votes WHERE review_id IN (SELECT id FROM reviews WHERE game_id = ?)').bind(id),
    db.prepare('DELETE FROM reviews WHERE game_id = ?').bind(id),
    db.prepare('DELETE FROM post_votes WHERE post_id IN (SELECT id FROM posts WHERE game_id = ?)').bind(id),
    db.prepare('DELETE FROM replies WHERE post_id IN (SELECT id FROM posts WHERE game_id = ?)').bind(id),
    db.prepare('DELETE FROM posts WHERE game_id = ?').bind(id),
    db.prepare('DELETE FROM events WHERE game_id = ?').bind(id),
    db.prepare('DELETE FROM play_tokens WHERE game_id = ?').bind(id),
    db.prepare('UPDATE users SET playing_game = NULL WHERE playing_game = ?').bind(id),
    ...['library', 'wishlist', 'cart', 'ignored', 'followed'].map(t => db.prepare(`DELETE FROM ${t} WHERE game_id = ?`).bind(id)),
    db.prepare('DELETE FROM games WHERE id = ?').bind(id),
  ]
}

/** Removes every game a user published (used when the account is deleted). */
export async function purgeUserGames(env: Env, userId: string): Promise<void> {
  const { results } = await env.DB.prepare('SELECT id FROM games WHERE owner_id = ?').bind(userId).all<{ id: number }>()
  for (const g of results) {
    await env.DB.batch(purgeStatements(env, g.id))
    await deletePrefix(env, `games/${g.id}/`)
  }
}

function parseMeta(b: Record<string, unknown>) {
  const title = cleanText(b.title, 60)
  const blurb = cleanText(b.blurb, 600, true)
  const genre = (Array.isArray(b.genre) ? b.genre : []).filter((g): g is string => typeof g === 'string' && GENRES.includes(g)).slice(0, 3)
  const tags = (Array.isArray(b.tags) ? b.tags : []).map(t => cleanText(t, 24)).filter(Boolean).slice(0, 10)
  const price = Number(b.price)
  if (title.length < 3) return { error: 'Give your game a title of at least 3 characters' }
  if (blurb.length < 10) return { error: 'Write a short description (at least 10 characters)' }
  if (genre.length === 0) return { error: 'Pick at least one genre' }
  if (!Number.isInteger(price) || price < 0 || price > MAX_PRICE) return { error: `Price must be between $0 and $${MAX_PRICE / 100}` }
  return { title, blurb, genre, tags, price }
}

export const devRoutes: Route[] = [
  route('GET', '/dev/genres', { auth: false }, async () => json({ genres: GENRES })),

  route('GET', '/dev/games', {}, async c => {
    const { results } = await c.env.DB.prepare(`${SELECT} WHERE g.owner_id = ? ORDER BY g.created_at DESC`).bind(c.user!.id).all<GameRow & { owner: string }>()
    return json({ games: results.map(shapeGame) })
  }),

  route('POST', '/dev/games', {}, async c => {
    const b = await readJson<Record<string, unknown>>(c.req, 8_000)
    const m = parseMeta(b)
    if ('error' in m) return fail(400, m.error!)
    const mine = await c.env.DB.prepare('SELECT COUNT(*) AS n, SUM(created_at > ?) AS recent FROM games WHERE owner_id = ?').bind(Date.now() - HOUR, c.user!.id).first<{ n: number; recent: number | null }>()
    if ((mine?.n ?? 0) >= MAX_GAMES_PER_USER) return fail(409, `You can have up to ${MAX_GAMES_PER_USER} games`)
    if ((mine?.recent ?? 0) >= MAX_CREATES_PER_HOUR) return tooMany()
    const now = Date.now()
    const tags = JSON.stringify(m.tags), genre = JSON.stringify(m.genre)
    // user games start at id 1000; the built-in catalog is below that
    const r = await c.env.DB.prepare(
      `INSERT INTO games (id, title, dev, genre, price, discount, rating, released, blurb, hue, icon, tags, publisher, reviews, achievements, size_gb, motif, owner_id, status, created_at)
       SELECT MAX(1000, COALESCE(MAX(id), 0) + 1), ?, ?, ?, ?, 0, 0, '', ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 'draft', ? FROM games RETURNING id`,
    ).bind(m.title, c.user!.display_name, genre, m.price, m.blurb, Math.floor(Math.random() * 360), m.title[0], tags, c.user!.display_name,
      ['space', 'mountain', 'ocean', 'city', 'forest', 'desert', 'circuit', 'dungeon', 'sun'][Math.floor(Math.random() * 9)], c.user!.id, now).first<{ id: number }>()
    return json({ id: r!.id }, 201)
  }),

  route('PUT', '/dev/games/:id', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    const m = parseMeta(await readJson<Record<string, unknown>>(c.req, 8_000))
    if ('error' in m) return fail(400, m.error!)
    await c.env.DB.prepare('UPDATE games SET title = ?, blurb = ?, genre = ?, tags = ?, price = ?, icon = ? WHERE id = ?')
      .bind(m.title, m.blurb, JSON.stringify(m.genre), JSON.stringify(m.tags), m.price, m.title![0], g.id).run()
    return json({ ok: true })
  }),

  // ---- file uploads (raw bodies) ----
  route('PUT', '/dev/games/:id/cover', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    const len = Number(c.req.headers.get('content-length') ?? 0)
    if (!len || len > MAX_COVER) return fail(413, 'Cover images can be up to 2 MB')
    const bytes = new Uint8Array(await c.req.arrayBuffer())
    const type = imageType(bytes)
    if (!type || bytes.length > MAX_COVER) return fail(415, 'Covers must be PNG, JPEG or WebP images')
    await c.env.FILES.put(`games/${g.id}/cover`, bytes, { httpMetadata: { contentType: type } })
    await c.env.DB.prepare('UPDATE games SET has_cover = 1 WHERE id = ?').bind(g.id).run()
    return json({ ok: true })
  }),

  route('PUT', '/dev/games/:id/build', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    const len = Number(c.req.headers.get('content-length') ?? 0)
    if (!len || !c.req.body) return fail(411, 'Content-Length is required')
    if (len > MAX_BUILD) return fail(413, `Downloadable builds can be up to ${MAX_BUILD / 1024 / 1024} MB`)
    const name = safeName(c.url.searchParams.get('name') ?? 'game.zip')
    await c.env.FILES.put(`games/${g.id}/build`, c.req.body, { httpMetadata: { contentType: 'application/octet-stream' } })
    await c.env.DB.prepare('UPDATE games SET build_name = ?, build_size = ?, size_gb = ? WHERE id = ?').bind(name, len, Math.max(0.001, len / 1024 ** 3), g.id).run()
    return json({ ok: true, name, size: len })
  }),

  route('PUT', '/dev/games/:id/web', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    const len = Number(c.req.headers.get('content-length') ?? 0)
    if (!len || len > MAX_ZIP) return fail(413, `Web builds must be a .zip of up to ${MAX_ZIP / 1024 / 1024} MB`)
    const zip = new Uint8Array(await c.req.arrayBuffer())
    if (zip.length > MAX_ZIP) return fail(413, 'zip too large')
    let total = 0, count = 0
    let files: Record<string, Uint8Array>
    try {
      // the filter sees each entry's declared size first, so a zip bomb is refused before anything is inflated
      files = unzipSync(zip, {
        filter: f => {
          if (f.name.endsWith('/')) return false
          count++; total += f.originalSize
          if (count > MAX_WEB_FILES || f.originalSize > MAX_WEB_FILE || total > MAX_WEB_TOTAL) throw new Error('limits')
          return true
        },
      })
    } catch { return fail(400, `That zip could not be read, or it is too big (max ${MAX_WEB_FILES} files and ${MAX_WEB_TOTAL / 1024 / 1024} MB unpacked)`) }
    let names = Object.keys(files).filter(n => !n.startsWith('__MACOSX/') && !n.split('/').some(p => p === '.DS_Store'))
    // allow a single wrapping folder: my-game/index.html
    const top = new Set(names.map(n => n.split('/')[0]))
    if (!names.includes('index.html') && top.size === 1 && names.every(n => n.includes('/')) && names.includes(`${[...top][0]}/index.html`)) {
      const pre = `${[...top][0]}/`
      files = Object.fromEntries(names.map(n => [n.slice(pre.length), files[n]]))
      names = Object.keys(files)
    }
    if (!names.includes('index.html')) return fail(400, 'The zip needs an index.html at its top level')
    for (const n of names) if (n.startsWith('/') || n.includes('..') || n.includes('\\') || n.length > 200) return fail(400, `Unsafe file path in zip: ${n.slice(0, 60)}`)
    await deletePrefix(c.env, `games/${g.id}/web/`)
    for (const n of names) {
      await c.env.FILES.put(`games/${g.id}/web/${n}`, files[n], { httpMetadata: { contentType: MIME[extOf(n)] ?? 'application/octet-stream' } })
    }
    await c.env.DB.prepare("UPDATE games SET web_entry = 'index.html' WHERE id = ?").bind(g.id).run()
    return json({ ok: true, files: names.length })
  }),

  route('DELETE', '/dev/games/:id/build', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    await c.env.FILES.delete(`games/${g.id}/build`)
    await c.env.DB.prepare('UPDATE games SET build_name = NULL, build_size = 0 WHERE id = ?').bind(g.id).run()
    return json({ ok: true })
  }),
  route('DELETE', '/dev/games/:id/web', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    await deletePrefix(c.env, `games/${g.id}/web/`)
    await c.env.DB.prepare('UPDATE games SET web_entry = NULL WHERE id = ?').bind(g.id).run()
    return json({ ok: true })
  }),

  route('POST', '/dev/games/:id/publish', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    if (!g.web_entry && !g.build_name) return fail(400, 'Upload a web build or a downloadable build before publishing')
    await c.env.DB.prepare("UPDATE games SET status = 'published', released = CASE WHEN released = '' THEN ? ELSE released END WHERE id = ?")
      .bind(new Date().toISOString().slice(0, 10), g.id).run()
    if (g.status !== 'published') c.wait(logEvent(c.env, c.user!.id, 'published', g.id))
    return json({ ok: true })
  }),
  route('POST', '/dev/games/:id/unpublish', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    await c.env.DB.prepare("UPDATE games SET status = 'draft' WHERE id = ?").bind(g.id).run()
    return json({ ok: true })
  }),

  route('DELETE', '/dev/games/:id', {}, async c => {
    const g = await ownedGame(c)
    if (!g) return fail(404, 'no such game')
    const id = g.id
    await c.env.DB.batch(purgeStatements(c.env, id))
    c.wait(deletePrefix(c.env, `games/${id}/`))
    return json({ ok: true })
  }),

  // ---- public reads ----
  route('GET', '/games/:id/cover', { auth: false }, async c => {
    const o = await c.env.FILES.get(`games/${gameId(c)}/cover`)
    if (!o) return fail(404, 'no cover')
    // only ever served as the image type validated at upload, never executable
    return new Response(o.body, { headers: { 'content-type': o.httpMetadata?.contentType ?? 'image/png', 'cache-control': 'public, max-age=300', 'content-security-policy': "default-src 'none'; sandbox" } })
  }),

  route('GET', '/games/:id/download', {}, async c => {
    const g = await c.env.DB.prepare('SELECT g.build_name, g.owner_id, g.status FROM games g WHERE g.id = ?').bind(gameId(c)).first<{ build_name: string | null; owner_id: string | null; status: string }>()
    if (!g?.build_name) return fail(404, 'nothing to download')
    const owns = g.owner_id === c.user!.id || !!(await c.env.DB.prepare('SELECT 1 FROM library WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).first())
    if (!owns) return fail(403, 'Add this game to your library first')
    const o = await c.env.FILES.get(`games/${gameId(c)}/build`)
    if (!o) return fail(404, 'file missing')
    return new Response(o.body, { headers: {
      'content-type': 'application/octet-stream', 'content-length': String(o.size), 'content-disposition': `attachment; filename="${safeName(g.build_name)}"`, 'cache-control': 'private, no-store',
    } })
  }),

  /** Hands out a short-lived path segment that lets the sandboxed frame load a web game. */
  route('POST', '/games/:id/play-token', {}, async c => {
    const g = await c.env.DB.prepare('SELECT web_entry, owner_id, status FROM games WHERE id = ?').bind(gameId(c)).first<{ web_entry: string | null; owner_id: string | null; status: string }>()
    if (!g?.web_entry) return fail(404, 'This game cannot be played in the browser')
    const owns = g.owner_id === c.user!.id || !!(await c.env.DB.prepare('SELECT 1 FROM library WHERE user_id = ? AND game_id = ?').bind(c.user!.id, gameId(c)).first())
    if (!owns) return fail(403, 'Add this game to your library first')
    const token = b64url(randomBytes(24))
    const now = Date.now()
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM play_tokens WHERE expires_at < ?').bind(now),
      c.env.DB.prepare('INSERT INTO play_tokens (token_hash, user_id, game_id, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256Hex(token), c.user!.id, gameId(c), now + 6 * HOUR),
    ])
    return json({ url: `/play/${gameId(c)}/${token}/${g.web_entry}` })
  }),

  route('POST', '/games/:id/report', {}, async c => {
    const b = await readJson<{ reason: string }>(c.req)
    const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND at > ?').bind(c.user!.id, Date.now() - HOUR).first<{ n: number }>()
    if ((recent?.n ?? 0) >= 10) return tooMany()
    await c.env.DB.prepare('INSERT INTO reports (user_id, target, reason, at) VALUES (?, ?, ?, ?)').bind(c.user!.id, `game:${gameId(c)}`, cleanText(b.reason, 300) || 'no reason given', Date.now()).run()
    return json({ ok: true })
  }),
]

/** Serves a web game's files. Not under /api: it is loaded by a sandboxed iframe that holds no cookies. */
export async function servePlay(req: Request, env: Env): Promise<Response> {
  const m = /^\/play\/(\d+)\/([A-Za-z0-9_-]{20,64})\/(.+)$/.exec(new URL(req.url).pathname)
  const deny = (status: number, msg: string) => new Response(msg, { status, headers: { 'content-type': 'text/plain', 'x-content-type-options': 'nosniff' } })
  if (req.method !== 'GET') return deny(405, 'method not allowed')
  if (!m) return deny(404, 'not found')
  let path: string
  try { path = decodeURIComponent(m[3]) } catch { return deny(400, 'bad path') }
  if (path.includes('..') || path.startsWith('/') || path.includes('\\')) return deny(400, 'bad path')
  const ok = await env.DB.prepare('SELECT 1 FROM play_tokens WHERE token_hash = ? AND game_id = ? AND expires_at > ?').bind(await sha256Hex(m[2]), Number(m[1]), Date.now()).first()
  if (!ok) return deny(403, 'This play link has expired. Open the game again from your library.')
  const o = await env.FILES.get(`games/${m[1]}/web/${path}`)
  if (!o) return deny(404, 'not found')
  return new Response(o.body, { headers: {
    'content-type': MIME[extOf(path)] ?? 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, max-age=600',
    // The page runs in an opaque origin (no same-origin), may only talk to its own files, and may only be framed by reSteam.
    'content-security-policy': "sandbox allow-scripts allow-pointer-lock allow-forms; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'self'",
    'referrer-policy': 'no-referrer',
  } })
}
