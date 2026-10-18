import { guardRoutes } from './guard'
import { authenticate, authRoutes, readCookie, SESSION_COOKIE } from './auth'
import { communityRoutes } from './community'
import { adminRoutes } from './admin'
import { recsRoutes } from './recs'
import { devRoutes, servePlay } from './dev'
import { shopRoutes } from './shop'
import { socialRoutes } from './social'
import { type Ctx, type Env, type Route, HttpError, fail, json, tooMany } from './util'

export { UserHub } from './hub'

const ROUTES: Route[] = [...authRoutes, ...guardRoutes, ...socialRoutes, ...communityRoutes, ...devRoutes, ...adminRoutes, ...recsRoutes, ...shopRoutes]

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
}

function hardened(res: Response): Response {
  if (res.status === 101) return res // a websocket upgrade must be passed through untouched
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v)
  if (!out.headers.has('cache-control')) out.headers.set('cache-control', 'no-store')
  return out
}

async function handle(req: Request, env: Env, wait: (p: Promise<unknown>) => void): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api/, '')
  if (path === '/health') return json({ ok: true })

  // browsers always send Origin on cross-site requests; refuse anything not from this site
  const origin = req.headers.get('origin')
  if (origin && origin !== url.origin) return fail(403, 'cross-origin requests are not allowed')

  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown'
  if (!(await env.GENERAL_LIMITER.limit({ key: ip })).success) return tooMany()

  const mutating = req.method !== 'GET' && req.method !== 'HEAD'
  // defense in depth on top of SameSite=Strict cookies: state changes must come from our own fetch calls
  if (mutating && req.headers.get('x-requested-with') !== 'fetch') return fail(403, 'missing request header')

  const user = readCookie(req, SESSION_COOKIE) ? await authenticate(req, env) : null

  if (path === '/ws' && req.method === 'GET') {
    if (!user) return fail(401, 'not signed in')
    if (req.headers.get('upgrade') !== 'websocket') return fail(426, 'expected a websocket')
    if (origin !== url.origin) return fail(403, 'cross-origin requests are not allowed') // the handshake always carries Origin
    const stub = env.USER_HUB.get(env.USER_HUB.idFromName(user.id))
    // identity headers are set here, after the session check; nothing the client sends reaches the object
    return stub.fetch('https://hub/ws', { headers: { Upgrade: 'websocket', 'x-user-id': user.id, 'x-username': user.username } })
  }

  for (const r of ROUTES) {
    if (r.method !== req.method) continue
    const m = r.re.exec(path)
    if (!m) continue
    if (r.auth && !user) return fail(401, 'not signed in')
    if (r.write && user && !(await env.WRITE_LIMITER.limit({ key: user.id })).success) return tooMany()
    const params: Record<string, string> = {}
    r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]) } catch { params[k] = '' } })
    const c: Ctx = { req, env, url, ip, params, user, wait }
    return r.handler(c)
  }
  return fail(404, 'not found')
}

export default {
  async fetch(req, env, ctx) {
    try {
      if (new URL(req.url).pathname.startsWith('/play/')) return await servePlay(req, env)
      return hardened(await handle(req, env, p => ctx.waitUntil(p.catch(e => console.error('background task failed', e)))))
    } catch (e) {
      if (e instanceof HttpError) return hardened(fail(e.status, e.message))
      console.error(e)
      return hardened(fail(500, 'internal error'))
    }
  },
} satisfies ExportedHandler<Env>
