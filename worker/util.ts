export interface Limiter { limit(opts: { key: string }): Promise<{ success: boolean }> }

export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  USER_HUB: DurableObjectNamespace
  GENERAL_LIMITER: Limiter
  WRITE_LIMITER: Limiter
  NEW_USER_LIMITER: Limiter
  AUTH_LIMITER: Limiter
  LOGIN_LIMITER: Limiter
  /** Overrides the PBKDF2 iteration count (Workers cap it at 100000). */
  PBKDF2_ITERS?: string
}

export interface AuthUser {
  id: string
  username: string
  display_name: string
  status: string
  wallet: number
  privacy: string
  last_seen: number
  session: string
}

export interface Ctx {
  req: Request
  env: Env
  url: URL
  ip: string
  params: Record<string, string>
  user: AuthUser | null
  wait: (p: Promise<unknown>) => void
}

export type Handler = (c: Ctx) => Promise<Response>
export interface Route { method: string; re: RegExp; keys: string[]; auth: boolean; write: boolean; handler: Handler }

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })
export const fail = (status: number, error: string) => json({ error }, status)
export const tooMany = () =>
  new Response(JSON.stringify({ error: 'too many requests, slow down' }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '10' } })

export const MAX_BODY_BYTES = 16_384

/** Reads a bounded JSON body; malformed bodies become {} so field checks reject them. */
export async function readJson<T>(req: Request, limit = MAX_BODY_BYTES): Promise<Partial<T>> {
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > limit) throw new HttpError(413, 'request body too large')
  const text = await req.text()
  if (text.length > limit) throw new HttpError(413, 'request body too large')
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Partial<T>) : {}
  } catch { return {} }
}

/** Declares a route. `:name` segments become params; auth/write default to the safe choice. */
export function route(method: string, path: string, opts: { auth?: boolean; write?: boolean }, handler: Handler): Route {
  const keys: string[] = []
  const re = new RegExp('^' + path.replace(/:([A-Za-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$')
  return { method, re, keys, auth: opts.auth ?? true, write: opts.write ?? method !== 'GET', handler }
}

// ---- text and validation ----
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
export const RESERVED = new Set(['admin', 'administrator', 'root', 'system', 'support', 'moderator', 'mod', 'staff', 'resteam', 'null', 'undefined', 'me'])

/** Trims and strips control characters (keeping newlines in multi-line text). */
export function cleanText(s: unknown, max: number, multiline = false): string {
  if (typeof s !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  const stripped = s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '')
  return stripped.replace(/\r\n?/g, '\n').trim().slice(0, max)
}

// ---- encoding and hashing ----
const enc = new TextEncoder()
export const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
export const fromHex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map(x => parseInt(x, 16)))
export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))
export const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const sha256Hex = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)))

export async function pbkdf2(secret: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256))
}
export function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}

// ---- presence ----
const ONLINE_WINDOW_MS = 120_000
export interface PresenceRow { status: string; last_seen: number; playing_game: number | null; playing_at: number }
export function presenceOf(u: PresenceRow, now = Date.now()) {
  if (u.status === 'offline') return { status: 'offline', gameId: null as number | null, lastSeen: null as number | null } // invisible
  if (u.playing_game && now - u.playing_at < ONLINE_WINDOW_MS) return { status: 'ingame', gameId: u.playing_game, lastSeen: u.last_seen }
  if (u.last_seen && now - u.last_seen < ONLINE_WINDOW_MS) return { status: u.status, gameId: null, lastSeen: u.last_seen }
  return { status: 'offline', gameId: null, lastSeen: u.last_seen || null }
}
