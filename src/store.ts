import { makeAutoObservable, autorun, runInAction } from 'mobx'
import { ALL_TAGS, GAMES, GENRES, LOCAL_ID, isLocal, priceOf, type Game, type Presence } from './data'

export interface User { username: string; name: string }
export interface ChatMessage { id?: number; from: 'me' | string; text: string; at: number }
export interface FriendPresence { status: Presence; gameId?: number | null; lastSeen?: number | null }
export interface Friend { username: string; name: string; nickname?: string | null; presence: FriendPresence; unread: number; since?: number }
export interface FriendRequest { username: string; name: string; at: number }
export interface Group { id: string; name: string; mine: boolean; members: number }
export interface GroupMember { username: string; name: string }
export interface GroupMessage { id: number; from: 'me' | string; text: string; at: number }
export interface Person { username: string; name: string }
export interface Notification { id: number; kind: string; data: Record<string, any>; at: number; read: boolean }
export interface ActivityEvent { id: number; kind: string; gameId: number | null; data: Record<string, any>; at: number; user: 'me' | Person }
export interface DownloadItem { id: number; progress: number; phase: string; speed: number; paused: boolean; real?: boolean; bytes?: number; total?: number }
export interface Toast { id: number; text: string }
export interface Settings {
  uiScale: number // 0.85 .. 1.3
  gridSize: number // library tile min width in px
  bandwidthLimit: number // MB/s, 0 = unlimited
  autoUpdates: boolean
  downloadsDuringGame: boolean
  reduceMotion: boolean
  overlay: boolean
  fpsCounter: boolean
  cloud: boolean
  notifySounds: boolean
}
export type Privacy = 'public' | 'friends' | 'private'
export interface CustomGame { id: number; title: string }
export interface Collection { id: string; name: string; games: number[] }
export type Shelf = 'whatsnew' | 'recent' | 'favorites' | 'playnext' | 'installed'
export type Account = 'loading' | 'out' | 'in'

const LOCAL = 'resteam:local:v2'

interface LocalState {
  settings: Settings
  customGames: CustomGame[]
  hints: Record<string, boolean>
  shelves: Shelf[]
  libraryGrid: boolean
  installedOnly: boolean
  recentSort: boolean
  viewed: number[]
  collections: Collection[]
  favFriends: string[]
}

const DEFAULT_SETTINGS: Settings = {
  uiScale: 1, gridSize: 150, bandwidthLimit: 0, autoUpdates: true, downloadsDuringGame: false,
  reduceMotion: false, overlay: true, fpsCounter: false, cloud: true, notifySounds: true,
}

const readJson = <T,>(k: string, fallback: T): T => {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(k) ?? '{}') } } catch { return fallback }
}

interface Me {
  username: string; name: string; status: 'online' | 'away' | 'offline'; wallet: number; privacy: Privacy
  owned: number[]; installed: number[]; playtime: Record<number, number>; favorites: number[]; lastPlayed: Record<number, number>
  wishlist: number[]; cart: number[]; ignored: number[]; followed: number[]
}

/** Calls the Worker API with the session cookie; surfaces the server's error text so forms can show it. */
export async function call<T>(method: string, path: string, body?: unknown): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'x-requested-with': 'fetch', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const j = await res.json().catch(() => ({}))
    return res.ok ? { data: j as T, status: res.status } : { error: (j as { error?: string }).error ?? 'request failed', status: res.status }
  } catch { return { error: 'Could not reach the server', status: 0 } }
}
/** Like call(), but resolves null on any failure so the UI keeps working offline. */
export const api = async <T,>(method: string, path: string, body?: unknown): Promise<T | null> => (await call<T>(method, path, body)).data ?? null

const sizeMb = (id: number) => (GAMES.find(g => g.id === id)?.sizeGb ?? 1) * 1024

class Store {
  // auth
  account: Account = 'loading'
  catalogReady = false
  recs: { id: number; because: string | null }[] = []
  user: User | null = null
  // server-backed
  owned: number[] = []
  wishlist: number[] = []
  cart: number[] = []
  wallet = 0
  installed: number[] = []
  favorites: number[] = []
  lastPlayed: Record<number, number> = {}
  playtime: Record<number, number> = {}
  ignored: number[] = []
  followed: number[] = []
  status: 'online' | 'away' | 'offline' = 'online'
  privacy: Privacy = 'public'
  admin = false
  // social
  friends: Friend[] = []
  incoming: FriendRequest[] = []
  outgoing: FriendRequest[] = []
  chats: Record<string, ChatMessage[]> = {}
  groups: Group[] = []
  groupMessages: Record<string, GroupMessage[]> = {}
  groupMembers: Record<string, GroupMember[]> = {}
  notifications: Notification[] = []
  activity: ActivityEvent[] = []
  typing: Record<string, boolean> = {}
  socket: 'closed' | 'connecting' | 'open' = 'closed'
  // local (per browser)
  settings: Settings = DEFAULT_SETTINGS
  customGames: CustomGame[] = []
  hints: Record<string, boolean> = {}
  shelves: Shelf[] = ['whatsnew', 'recent']
  libraryGrid = false
  installedOnly = false
  recentSort = false
  viewed: number[] = []
  collections: Collection[] = []
  favFriends: string[] = []
  // session
  queue: DownloadItem[] = []
  speedHistory: number[] = []
  peakSpeed = 0
  completed: { id: number; at: number }[] = []
  running: number | null = null
  openChats: string[] = []
  toasts: Toast[] = []
  friendsOpen = false

  private ws?: WebSocket
  private wsTimer?: ReturnType<typeof setTimeout>
  private pingTimer?: ReturnType<typeof setInterval>
  private typingTimers: Record<string, ReturnType<typeof setTimeout>> = {}
  private lastTypingSent = 0
  private playTick?: ReturnType<typeof setInterval>
  private unsent = 0

  constructor() {
    const local = readJson<Partial<LocalState>>(LOCAL, {})
    Object.assign(this, local, { settings: { ...DEFAULT_SETTINGS, ...(local.settings ?? {}) } })
    makeAutoObservable<Store, 'aborts' | 'ws' | 'wsTimer' | 'pingTimer' | 'typingTimers' | 'lastTypingSent' | 'playTick' | 'unsent'>(this, {
      aborts: false, ws: false, wsTimer: false, pingTimer: false, typingTimers: false, lastTypingSent: false, playTick: false, unsent: false,
    })
    void this.bootstrap()
    void this.loadCatalog().then(() => { void this.loadStats(); void this.loadRecs() })
    setInterval(() => this.tickDownloads(), 250)
    autorun(() => {
      const l: LocalState = {
        settings: this.settings, customGames: this.customGames, hints: this.hints, shelves: this.shelves, libraryGrid: this.libraryGrid,
        installedOnly: this.installedOnly, recentSort: this.recentSort, viewed: this.viewed, collections: this.collections, favFriends: this.favFriends,
      }
      try { localStorage.setItem(LOCAL, JSON.stringify(l)) } catch { /* storage unavailable */ }
    })
    autorun(() => {
      // everything is sized in px, so scale with zoom and tell the layout how tall the zoomed window may be
      document.body.style.zoom = String(this.settings.uiScale)
      document.documentElement.style.setProperty('--ui-scale', String(this.settings.uiScale))
      document.documentElement.classList.toggle('reduce-motion', this.settings.reduceMotion)
    })
  }

  // ---- derived ----
  get name() { return this.user?.name ?? '' }
  get signedIn() { return this.account === 'in' }
  get ownedGames() { return GAMES.filter(g => this.owned.includes(g.id)) }
  get cartGames() { return GAMES.filter(g => this.cart.includes(g.id)) }
  get cartTotal() { return this.cartGames.reduce((n, g) => n + priceOf(g), 0) }
  get wishlistGames() { return GAMES.filter(g => this.wishlist.includes(g.id)) }
  get activeDownload() { return this.queue.find(d => !d.paused) }
  get storageUsedGb() { return this.installed.reduce((n, id) => n + sizeMb(id) / 1024, 0) }
  get unreadCount() { return this.notifications.filter(n => !n.read).length }
  get unreadChats() { return this.friends.reduce((n, f) => n + f.unread, 0) }
  get onlineFriends() { return this.friends.filter(f => f.presence.status !== 'offline') }
  friend(username: string) { return this.friends.find(f => f.username.toLowerCase() === username.toLowerCase()) }
  friendsPlaying(gameId: number) { return this.friends.filter(f => f.presence.status === 'ingame' && f.presence.gameId === gameId) }

  toast(text: string) {
    const id = Date.now() + Math.random()
    this.toasts.push({ id, text })
    setTimeout(() => runInAction(() => { this.toasts = this.toasts.filter(t => t.id !== id) }), 3500)
  }

  // ---- accounts ----
  private apply(m: Me) {
    this.user = { username: m.username, name: m.name }
    this.owned = m.owned; this.wishlist = m.wishlist; this.cart = m.cart; this.wallet = m.wallet
    this.installed = m.installed; this.favorites = m.favorites; this.lastPlayed = m.lastPlayed
    this.playtime = m.playtime; this.status = m.status; this.privacy = m.privacy
    this.ignored = m.ignored; this.followed = m.followed
  }
  private clearAccount() {
    this.stopSocket()
    clearInterval(this.playTick)
    this.user = null; this.running = null; this.admin = false
    this.owned = []; this.wishlist = []; this.cart = []; this.wallet = 0; this.installed = []; this.favorites = []
    this.lastPlayed = {}; this.playtime = {}; this.ignored = []; this.followed = []
    this.friends = []; this.incoming = []; this.outgoing = []; this.chats = {}; this.groups = []; this.groupMessages = {}; this.groupMembers = {}
    this.notifications = []; this.activity = []; this.typing = {}; this.openChats = []; this.friendsOpen = false
    this.queue = []
  }
  private enter(m: Me) {
    this.apply(m)
    this.account = 'in'
    void this.loadRecs()
    this.startSocket()
    void this.refreshSocial()
    void api<{ admin: boolean }>('GET', '/admin/me').then(r => runInAction(() => { this.admin = !!r?.admin }))
  }
  async bootstrap() {
    const m = await api<Me>('GET', '/me')
    runInAction(() => { if (m) this.enter(m); else this.account = 'out' })
  }
  async hydrate() {
    const m = await api<Me>('GET', '/me')
    if (m) runInAction(() => this.apply(m))
  }
  /** Pulls the live catalog (built-in games plus everything players published) into the shared GAMES list. */
  async loadCatalog() {
    const list = await api<Game[]>('GET', '/games')
    runInAction(() => {
      if (list) {
        const ids = new Set(list.map(g => g.id))
        for (const s of list) {
          const have = GAMES.find(g => g.id === s.id)
          if (have) Object.assign(have, { price: s.price, discount: s.discount, hasCover: s.hasCover, shots: s.shots, version: s.version, achievements: s.achievements, playable: s.playable, build: s.build, owner: s.owner, user: s.user, sizeGb: s.sizeGb || have.sizeGb })
          else GAMES.push({ ...s, rating: 0, reviews: 0, owners: 0, playing: 0 })
        }
        // drop uploaded games that were unpublished or deleted
        for (let i = GAMES.length - 1; i >= 0; i--) if (GAMES[i].user && !ids.has(GAMES[i].id)) GAMES.splice(i, 1)
        GENRES.splice(0, GENRES.length, ...[...new Set(GAMES.flatMap(g => g.genre))].sort())
        ALL_TAGS.splice(0, ALL_TAGS.length, ...[...new Set(GAMES.flatMap(g => g.tags))].sort())
      }
      this.catalogReady = true
    })
  }
  /** Personalised picks from the server (popular games for guests). Reload after anything that changes your taste. */
  async loadRecs() {
    const r = await api<{ recommendations: { id: number; because: string | null }[] }>('GET', '/recommendations')
    if (r) runInAction(() => { this.recs = r.recommendations })
  }
  /** Loads public review counts into the catalog so every price/rating widget reads real data. */
  async loadStats() {
    const r = await api<{ stats: Record<string, { reviews: number; positive: number; recent: number; recent_positive: number; owners: number; playing: number }> }>('GET', '/stats')
    if (!r) return
    runInAction(() => {
      for (const g of GAMES) {
        const s = r.stats[g.id]
        g.reviews = s?.reviews ?? 0
        g.rating = s && s.reviews > 0 ? Math.round((s.positive / s.reviews) * 100) : 0
        g.recentReviews = s?.recent ?? 0
        g.recentRating = s && s.recent > 0 ? Math.round((s.recent_positive / s.recent) * 100) : 0
        g.owners = s?.owners ?? 0
        g.playing = s?.playing ?? 0
      }
    })
  }
  /** `guard: true` means the password was right and an authenticator or backup code is needed to finish. */
  async signIn(username: string, password: string, remember: boolean, code?: string): Promise<{ error?: string; guard?: boolean }> {
    const { data, error } = await call<{ user?: User; guard?: boolean }>('POST', '/auth/login', { username, password, remember, code })
    if (!data) return { error: error ?? 'Could not sign in' }
    if (data.guard) return { guard: true }
    const m = await api<Me>('GET', '/me')
    if (m) runInAction(() => this.enter(m))
    return {}
  }
  /** Resolves the one-time recovery key on success. */
  async register(username: string, password: string, remember: boolean): Promise<{ error?: string; recoveryCode?: string }> {
    const { data, error } = await call<{ user: User; recoveryCode: string }>('POST', '/auth/register', { username, password, remember })
    if (!data) return { error: error ?? 'Could not create the account' }
    const m = await api<Me>('GET', '/me')
    if (m) runInAction(() => this.enter(m))
    return { recoveryCode: data.recoveryCode }
  }
  async recover(username: string, recoveryCode: string, newPassword: string): Promise<{ error?: string; recoveryCode?: string }> {
    const { data, error } = await call<{ recoveryCode: string }>('POST', '/auth/recover', { username, recoveryCode, newPassword })
    if (!data) return { error: error ?? 'Recovery failed' }
    return { recoveryCode: data.recoveryCode }
  }
  async signOut() {
    await call('POST', '/auth/logout')
    runInAction(() => { this.clearAccount(); this.account = 'out' })
  }
  async changePassword(current: string, next: string): Promise<string | null> {
    return (await call('POST', '/auth/password', { current, next })).error ?? null
  }
  async deleteAccount(password: string): Promise<string | null> {
    const { error } = await call('DELETE', '/auth/account', { password })
    if (error) return error
    runInAction(() => { this.clearAccount(); this.account = 'out' })
    return null
  }
  async setName(name: string): Promise<string | null> { return this.sync('PUT', '/profile', { name }) }
  async setPrivacy(privacy: Privacy): Promise<string | null> { return this.sync('PUT', '/profile', { privacy }) }
  async setStatus(status: 'online' | 'away' | 'offline') {
    this.status = status
    await call('PUT', '/presence', { status })
  }

  /** Fire a mutation; on rejection fall back to the server's truth. */
  private async sync(method: string, path: string, body?: unknown): Promise<string | null> {
    const { data, error } = await call<Me>(method, path, body)
    if (data) { runInAction(() => this.apply(data)); return null }
    await this.hydrate()
    if (error) runInAction(() => this.toast(error))
    return error ?? null
  }

  // ---- shopping ----
  /** Store actions need an account; send guests to the sign-in page and come back afterwards. */
  needLogin(): boolean {
    if (this.account === 'in') return false
    this.toast('Sign in to do that')
    const here = location.hash.replace(/^#/, '') || '/store'
    location.hash = `#/login?next=${encodeURIComponent(here)}`
    return true
  }
  toggleWishlist(id: number) {
    if (this.needLogin()) return
    const had = this.wishlist.includes(id)
    this.wishlist = had ? this.wishlist.filter(x => x !== id) : [...this.wishlist, id]
    void this.sync(had ? 'DELETE' : 'PUT', `/wishlist/${id}`)
  }
  addToCart(id: number) {
    if (this.needLogin()) return
    if (this.cart.includes(id) || this.owned.includes(id)) return
    this.cart.push(id)
    void this.sync('PUT', `/cart/${id}`)
  }
  removeFromCart(id: number) {
    this.cart = this.cart.filter(x => x !== id)
    void this.sync('DELETE', `/cart/${id}`)
  }
  async addFunds(cents: number): Promise<string | null> { return this.sync('POST', '/wallet', { cents }) }
  async checkout(): Promise<string | null> {
    if (this.cartTotal > this.wallet) return 'Not enough funds in your reSteam Wallet'
    return this.sync('POST', '/checkout')
  }
  claimFree(id: number) {
    if (this.needLogin()) return
    if (this.owned.includes(id)) return
    this.owned.push(id)
    void this.sync('POST', `/claim/${id}`)
  }
  async redeem(code: string): Promise<string | null> { return this.sync('POST', '/redeem', { code }) }
  async gift(username: string, cents: number): Promise<string | null> {
    const err = await this.sync('POST', '/gift', { username, cents })
    if (!err) void this.loadChat(username)
    return err
  }
  toggleIgnore(id: number) {
    if (this.needLogin()) return
    const had = this.ignored.includes(id)
    this.ignored = had ? this.ignored.filter(x => x !== id) : [...this.ignored, id]
    void this.sync(had ? 'DELETE' : 'PUT', `/ignored/${id}`)
    if (!had && this.wishlist.includes(id)) this.toggleWishlist(id)
  }
  toggleFollow(id: number) {
    if (this.needLogin()) return
    const had = this.followed.includes(id)
    this.followed = had ? this.followed.filter(x => x !== id) : [...this.followed, id]
    void this.sync(had ? 'DELETE' : 'PUT', `/followed/${id}`)
  }

  // ---- custom library collections (kept on this browser) ----
  createCollection(name: string, gameId?: number) {
    const n = name.trim().slice(0, 30)
    if (!n) return
    this.collections.push({ id: `c${Date.now()}`, name: n, games: gameId ? [gameId] : [] })
  }
  renameCollection(id: string, name: string) { const c = this.collections.find(x => x.id === id); const n = name.trim().slice(0, 30); if (c && n) c.name = n }
  deleteCollection(id: string) { this.collections = this.collections.filter(c => c.id !== id) }
  addToCollection(id: string, gameId: number) { const c = this.collections.find(x => x.id === id); if (c && !c.games.includes(gameId)) c.games.push(gameId) }
  removeFromCollection(id: string, gameId: number) { const c = this.collections.find(x => x.id === id); if (c) c.games = c.games.filter(g => g !== gameId) }
  toggleFavFriend(username: string) { this.favFriends = this.favFriends.includes(username) ? this.favFriends.filter(x => x !== username) : [...this.favFriends, username] }
  view(id: number) { this.viewed = [id, ...this.viewed.filter(x => x !== id)].slice(0, 12) }

  // ---- library ----
  toggleFavorite(id: number) {
    if (this.needLogin()) return
    const had = this.favorites.includes(id)
    this.favorites = had ? this.favorites.filter(x => x !== id) : [...this.favorites, id]
    void this.sync(had ? 'DELETE' : 'PUT', `/favorites/${id}`)
  }
  uninstall(id: number) {
    this.installed = this.installed.filter(x => x !== id)
    void this.sync('DELETE', `/installed/${id}`)
  }
  addShelf(s: Shelf) { if (!this.shelves.includes(s)) this.shelves.push(s) }
  removeShelf(s: Shelf) { this.shelves = this.shelves.filter(x => x !== s) }
  addCustomGame(title: string) {
    const t = title.trim().slice(0, 40)
    if (!t) return
    this.customGames.push({ id: LOCAL_ID + this.customGames.length + 1, title: t })
    this.toast(`${t} was added to your library`)
  }

  // ---- downloads (single active download, the rest queue) ----
  install(id: number, force = false) {
    if ((this.installed.includes(id) && !force) || this.queue.some(d => d.id === id)) return
    const g = GAMES.find(x => x.id === id)
    if (g?.playable && !g.build) { void this.sync('PUT', `/installed/${id}`); this.toast(`${g.title} is ready to play`); return }
    const real = !!g?.build
    this.queue.push({ id, progress: 0, phase: 'Starting Download', speed: 0, paused: false, real, bytes: 0, total: g?.build?.size })
    if (real) void this.runDownload(id)
  }
  pause(id: number) { const d = this.queue.find(x => x.id === id); if (d) { d.paused = true; d.speed = 0; this.aborts[id]?.abort() } }
  resume(id: number) { const d = this.queue.find(x => x.id === id); if (d) { d.paused = false; if (d.real) void this.runDownload(id) } }
  cancel(id: number) { this.aborts[id]?.abort(); this.queue = this.queue.filter(d => d.id !== id) }
  /** A real download: streams the uploaded build, reports true progress and speed, then saves the file to disk. */
  private async runDownload(id: number) {
    const g = GAMES.find(x => x.id === id)
    const ctl = new AbortController()
    this.aborts[id] = ctl
    try {
      const res = await fetch(`/api/games/${id}/download`, { credentials: 'same-origin', signal: ctl.signal })
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? 'Download failed')
      const total = Number(res.headers.get('content-length') ?? g?.build?.size ?? 0)
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let got = 0, last = performance.now(), lastBytes = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value); got += value.length
        const now = performance.now()
        if (now - last > 200) {
          const speed = ((got - lastBytes) / 1048576) / ((now - last) / 1000)
          last = now; lastBytes = got
          runInAction(() => {
            const d = this.queue.find(x => x.id === id)
            if (!d) return
            d.bytes = got; d.speed = speed; d.progress = total ? Math.min(99, (got / total) * 100) : 50
            d.phase = 'Downloading'
            this.peakSpeed = Math.max(this.peakSpeed, speed)
            this.speedHistory = [...this.speedHistory.slice(-59), speed]
          })
        }
      }
      const url = URL.createObjectURL(new Blob(chunks as BlobPart[]))
      const a = document.createElement('a')
      a.href = url; a.download = g?.build?.name ?? 'game.zip'; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      runInAction(() => {
        this.queue = this.queue.filter(x => x.id !== id)
        this.completed.unshift({ id, at: Date.now() })
        if (!this.installed.includes(id)) this.installed.push(id)
        this.toast(`${g?.title ?? 'Game'} was downloaded`)
      })
      void this.sync('PUT', `/installed/${id}`)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      runInAction(() => { this.queue = this.queue.filter(x => x.id !== id); this.toast((e as Error).message) })
    } finally { delete this.aborts[id] }
  }
  private aborts: Record<number, AbortController> = {}
  moveToFront(id: number) {
    const d = this.queue.find(x => x.id === id)
    if (d) this.queue = [d, ...this.queue.filter(x => x !== d)]
  }
  /** A real game is ~GBs; compress time so an install takes 8-40s, while the shown speed still reflects the limit. */
  private tickDownloads() {
    const d = this.activeDownload
    if (d?.real) return
    if (!d || (this.running !== null && !this.settings.downloadsDuringGame)) {
      this.speedHistory = [...this.speedHistory.slice(-59), 0]
      return
    }
    const mb = sizeMb(d.id)
    const baseSeconds = Math.min(45, Math.max(14, mb / 1024 * 1.2)) // keeps shown speeds under ~130 MB/s
    const natural = mb / baseSeconds
    const speed = Math.min(this.settings.bandwidthLimit || Infinity, natural * (0.85 + Math.random() * 0.3))
    d.speed = speed
    d.progress = Math.min(100, d.progress + (speed / mb) * 100 * 0.25)
    d.phase = d.progress < 3 ? 'Starting Download' : d.progress < 90 ? 'Downloading' : d.progress < 97 ? 'Installing' : 'Finalizing'
    this.peakSpeed = Math.max(this.peakSpeed, speed)
    this.speedHistory = [...this.speedHistory.slice(-59), speed]
    if (d.progress >= 100) {
      this.queue = this.queue.filter(x => x !== d)
      this.completed.unshift({ id: d.id, at: Date.now() })
      this.installed.push(d.id)
      this.toast(`${GAMES.find(g => g.id === d.id)?.title} finished installing`)
      void this.sync('PUT', `/installed/${d.id}`)
    }
  }

  /** Launching tells friends what you are playing; time accrues in the library once the server knows. */
  async play(id: number) {
    if (this.running !== null) return
    const web = GAMES.find(g => g.id === id)?.playable
    if (web && !this.installed.includes(id)) { await this.sync('PUT', `/installed/${id}`); runInAction(() => { if (!this.installed.includes(id)) this.installed.push(id) }) }
    if (!isLocal(id)) {
      const { error } = await call('POST', '/presence/playing', { gameId: id })
      if (error) { this.toast(error); return }
    }
    runInAction(() => {
      this.running = id
      this.lastPlayed[id] = Date.now()
      this.unsent = 0
      if (web) location.hash = `#/play/${id}`
      this.playTick = setInterval(() => runInAction(() => {
        this.playtime[id] = (this.playtime[id] ?? 0) + 1
        this.lastPlayed[id] = Date.now()
        this.unsent += 1
        if (!isLocal(id) && this.unsent >= 5) { const n = this.unsent; this.unsent = 0; void call('POST', `/playtime/${id}`, { minutes: n }) }
      }), 6000) // one "minute" per 6s so playtime visibly moves
    })
  }
  stop() {
    clearInterval(this.playTick)
    const id = this.running
    if (id !== null && !isLocal(id)) {
      if (this.unsent > 0) void call('POST', `/playtime/${id}`, { minutes: this.unsent }).then(() => call('POST', '/presence/playing', { gameId: null }))
      else void call('POST', '/presence/playing', { gameId: null })
    }
    this.unsent = 0
    this.running = null
  }

  // ---- friends ----
  async refreshSocial() {
    await Promise.all([this.refreshFriends(), this.refreshNotifications(), this.refreshActivity(), this.refreshGroups()])
  }
  async refreshFriends() {
    const r = await api<{ friends: Friend[]; incoming: FriendRequest[]; outgoing: FriendRequest[] }>('GET', '/friends')
    if (r) runInAction(() => { this.friends = r.friends; this.incoming = r.incoming; this.outgoing = r.outgoing })
  }
  async refreshNotifications() {
    const r = await api<{ notifications: Notification[] }>('GET', '/notifications')
    if (r) runInAction(() => { this.notifications = r.notifications })
  }
  async refreshActivity() {
    const r = await api<{ events: ActivityEvent[] }>('GET', '/activity')
    if (r) runInAction(() => { this.activity = r.events })
  }
  async refreshGroups() {
    const r = await api<{ groups: Group[] }>('GET', '/groups')
    if (r) runInAction(() => { this.groups = r.groups })
  }
  async markAllRead() {
    this.notifications.forEach(n => { n.read = true })
    await call('POST', '/notifications/read')
  }
  async sendRequest(username: string): Promise<string | null> {
    const { error } = await call('POST', '/friends/requests', { username: username.trim() })
    if (!error) void this.refreshFriends()
    return error ?? null
  }
  async acceptRequest(username: string) { await call('POST', `/friends/requests/${encodeURIComponent(username)}/accept`); await this.refreshFriends() }
  async declineRequest(username: string) { await call('DELETE', `/friends/requests/${encodeURIComponent(username)}`); await this.refreshFriends() }
  async setNickname(username: string, nickname: string): Promise<string | null> {
    const { error } = await call('PUT', `/friends/${encodeURIComponent(username)}/nickname`, { nickname })
    if (!error) await this.refreshFriends()
    return error ?? null
  }
  async removeFriend(username: string) {
    this.closeChat(username)
    await call('DELETE', `/friends/${encodeURIComponent(username)}`)
    await this.refreshFriends()
  }
  async block(username: string) {
    this.closeChat(username)
    await call('POST', `/blocks/${encodeURIComponent(username)}`)
    await this.refreshFriends()
  }
  async unblock(username: string) { await call('DELETE', `/blocks/${encodeURIComponent(username)}`); await this.refreshFriends() }
  async search(q: string): Promise<Person[]> {
    const r = await api<{ users: Person[] }>('GET', `/users/search?q=${encodeURIComponent(q)}`)
    return r?.users ?? []
  }

  // ---- direct messages ----
  async loadChat(username: string) {
    const r = await api<{ messages: ChatMessage[] }>('GET', `/chats/${encodeURIComponent(username)}`)
    if (r) runInAction(() => { this.chats[username.toLowerCase()] = r.messages })
  }
  chatKey(username: string) { return username.startsWith('g:') ? username : username.toLowerCase() }
  async openChat(username: string) {
    const key = this.chatKey(username)
    if (!this.openChats.includes(key)) this.openChats.push(key)
    this.friendsOpen = true
    if (key.startsWith('g:')) { await this.loadGroup(key.slice(2)); return }
    await this.loadChat(username)
    this.markRead(key)
  }
  markRead(username: string) {
    const f = this.friend(username)
    if (f && f.unread > 0) { f.unread = 0; void call('POST', `/chats/${encodeURIComponent(username)}/read`) }
  }
  closeChat(key: string) { const k = this.chatKey(key); this.openChats = this.openChats.filter(x => x !== k) }
  async send(username: string, text: string): Promise<string | null> {
    const t = text.trim()
    if (!t) return null
    const { data, error } = await call<{ message: ChatMessage }>('POST', `/chats/${encodeURIComponent(username)}`, { text: t })
    if (!data) { this.toast(error ?? 'Message not sent'); return error ?? 'Message not sent' }
    // the socket echoes our own message back too; drop duplicates by id
    runInAction(() => this.pushMessage(username, { ...data.message, from: 'me' }))
    return null
  }
  sendTyping(username: string) {
    const now = Date.now()
    if (now - this.lastTypingSent < 2500 || this.ws?.readyState !== WebSocket.OPEN) return
    this.lastTypingSent = now
    this.ws.send(JSON.stringify({ type: 'typing', to: username }))
  }
  private pushMessage(username: string, m: ChatMessage) {
    const key = username.toLowerCase()
    const list = (this.chats[key] ??= [])
    if (m.id !== undefined && list.some(x => x.id === m.id)) return
    list.push(m)
  }

  // ---- group chats ----
  async loadGroup(id: string) {
    const r = await api<{ messages: GroupMessage[]; members: GroupMember[] }>('GET', `/groups/${id}/messages`)
    if (r) runInAction(() => { this.groupMessages[id] = r.messages; this.groupMembers[id] = r.members })
  }
  async createGroup(name: string, members: string[]): Promise<string | null> {
    const { data, error } = await call<{ group: Group }>('POST', '/groups', { name: name.trim().slice(0, 30) || 'Group chat', members })
    if (!data) return error ?? 'Could not create the group'
    await this.refreshGroups()
    void this.openChat(`g:${data.group.id}`)
    return null
  }
  async sendGroup(id: string, text: string): Promise<string | null> {
    const t = text.trim().slice(0, 500)
    if (!t) return null
    const { data, error } = await call<{ message: GroupMessage }>('POST', `/groups/${id}/messages`, { text: t })
    if (!data) { this.toast(error ?? 'Message not sent'); return error ?? null }
    runInAction(() => {
      const list = (this.groupMessages[id] ??= [])
      if (!list.some(x => x.id === data.message.id)) list.push({ ...data.message, from: 'me' })
    })
    return null
  }
  async inviteToGroup(id: string, username: string): Promise<string | null> {
    const { error } = await call('POST', `/groups/${id}/invite`, { username })
    if (!error) void this.loadGroup(id)
    return error ?? null
  }
  async leaveGroup(id: string) {
    this.closeChat(`g:${id}`)
    await call('POST', `/groups/${id}/leave`)
    await this.refreshGroups()
  }

  // ---- realtime ----
  private startSocket() {
    this.stopSocket()
    if (this.account !== 'in') return
    this.socket = 'connecting'
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/ws`)
    this.ws = ws
    ws.onopen = () => runInAction(() => {
      this.socket = 'open'
      this.pingTimer = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); void call('POST', '/presence/ping') }, 45_000)
      void this.refreshSocial() // catch up on anything missed while disconnected
    })
    ws.onmessage = e => { try { runInAction(() => this.onPush(JSON.parse(String(e.data)))) } catch { /* ignore malformed frames */ } }
    ws.onclose = () => runInAction(() => {
      clearInterval(this.pingTimer)
      if (this.ws !== ws) return
      this.socket = 'closed'
      if (this.account === 'in') this.wsTimer = setTimeout(() => this.startSocket(), 3000 + Math.random() * 3000)
    })
  }
  private stopSocket() {
    clearTimeout(this.wsTimer); clearInterval(this.pingTimer)
    const ws = this.ws
    this.ws = undefined
    this.socket = 'closed'
    if (ws) { ws.onclose = null; ws.close() }
  }
  private onPush(ev: any) {
    switch (ev.type) {
      case 'dm': {
        const other: string = ev.from === 'me' ? ev.with : ev.from
        if (!other) return
        this.pushMessage(other, { id: ev.id, from: ev.from === 'me' ? 'me' : ev.from, text: ev.text, at: ev.at })
        if (ev.from !== 'me') {
          const key = other.toLowerCase()
          this.typing[key] = false
          const f = this.friend(other)
          if (this.openChats.includes(key) && this.friendsOpen) this.markRead(key)
          else if (f) { f.unread += 1; this.toast(`${f.name}: ${String(ev.text).slice(0, 60)}`) }
        }
        break
      }
      case 'typing': {
        const key = String(ev.from).toLowerCase()
        this.typing[key] = true
        clearTimeout(this.typingTimers[key])
        this.typingTimers[key] = setTimeout(() => runInAction(() => { this.typing[key] = false }), 4000)
        break
      }
      case 'friends': void this.refreshFriends(); break
      case 'notification': {
        if (!this.notifications.some(n => n.id === ev.id)) this.notifications.unshift({ id: ev.id, kind: ev.kind, data: ev.data ?? {}, at: ev.at, read: false })
        if (ev.kind === 'friend_request' || ev.kind === 'friend_accepted') void this.refreshFriends()
        if (ev.kind === 'group_invite') void this.refreshGroups()
        if (ev.kind === 'gift') void this.hydrate()
        this.toast(notificationText(ev as Notification))
        break
      }
      case 'group-message': {
        const id = String(ev.group)
        const list = (this.groupMessages[id] ??= [])
        if (!list.some(x => x.id === ev.id)) list.push({ id: ev.id, from: ev.from, text: ev.text, at: ev.at })
        if (!this.openChats.includes(`g:${id}`) && ev.from !== 'me') this.toast(`${this.groups.find(g => g.id === id)?.name ?? 'Group'}: ${String(ev.text).slice(0, 60)}`)
        break
      }
    }
  }
}

export const notificationText = (n: Pick<Notification, 'kind' | 'data'>): string => {
  const who = (n.data.from as Person | undefined)?.name ?? 'Someone'
  switch (n.kind) {
    case 'friend_request': return `${who} sent you a friend request`
    case 'friend_accepted': return `${who} accepted your friend request`
    case 'group_invite': return `${who} invited you to the group chat "${n.data.group?.name ?? 'Group chat'}"`
    case 'post_reply': return `${who} replied to your post "${n.data.title ?? ''}"`
    case 'review_helpful': return `${who} found your review helpful`
    case 'game_update': return `${n.data.title ?? 'A game you own'} was updated to version ${n.data.version}`
    case 'game_approved': return `${n.data.title ?? 'Your game'} was approved and is now live`
    case 'game_removed': return `${n.data.title ?? 'Your game'} was taken down: ${n.data.reason ?? 'see the moderators'}`
    case 'wishlist_sale': return `${n.data.title ?? 'A game on your wishlist'} is now ${n.data.percent}% off`
    case 'game_news': return `${n.data.title ?? 'A game you follow'}: ${n.data.headline ?? 'new announcement'}`
    case 'gift': return `${who} sent you ${n.data.cents ? `$${(Number(n.data.cents) / 100).toFixed(2)}` : 'a gift'} in wallet funds`
    default: return 'You have a new notification'
  }
}

export const store = new Store()
