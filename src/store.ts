import { makeAutoObservable, autorun, runInAction } from 'mobx'
import { BOT_REPLIES, FRIENDS, GAMES, NEWS, priceOf, type Friend } from './data'

export interface ChatMessage { from: 'me' | string; text: string; at: number }
export interface DownloadItem { id: number; progress: number; phase: string; speed: number; paused: boolean }
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
  profilePrivacy: 'public' | 'friends' | 'private'
}
export interface CustomGame { id: number; title: string }
export interface GroupChat { id: string; name: string; members: string[]; messages: ChatMessage[] }
export type Shelf = 'whatsnew' | 'recent' | 'favorites' | 'playnext' | 'installed'

const KEY = 'resteam:v1'
const LOCAL = 'resteam:local:v1'

interface Saved {
  owned: number[]
  wishlist: number[]
  cart: number[]
  wallet: number
  installed: number[]
  favorites: number[]
  lastPlayed: Record<number, number>
  playtime: Record<number, number>
  chats: Record<string, ChatMessage[]>
  status: Friend['status']
  name: string
}

interface LocalState {
  settings: Settings
  customGames: CustomGame[]
  hints: Record<string, boolean>
  readNotifs: string[]
  posts: Record<number, { text: string; at: number }[]>
  shelves: Shelf[]
  libraryGrid: boolean
  installedOnly: boolean
  recentSort: boolean
  groups: GroupChat[]
  viewed: number[]
}

const DEFAULT_SETTINGS: Settings = {
  uiScale: 1, gridSize: 150, bandwidthLimit: 0, autoUpdates: true, downloadsDuringGame: false,
  reduceMotion: false, overlay: true, fpsCounter: false, cloud: true, notifySounds: true, profilePrivacy: 'public',
}

const readJson = <T,>(k: string, fallback: T): T => {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(k) ?? '{}') } } catch { return fallback }
}

const sessionId = (): string => {
  try {
    let id = localStorage.getItem('resteam:session')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('resteam:session', id) }
    return id
  } catch { return crypto.randomUUID() }
}
let SESSION = sessionId()

interface Me extends Omit<Saved, 'chats'> { }

/** Calls the Worker API; surfaces the server's error text so forms can show it. */
async function call<T>(method: string, path: string, body?: unknown): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { 'x-session': SESSION, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const j = await res.json().catch(() => ({}))
    return res.ok ? { data: j as T } : { error: (j as { error?: string }).error ?? 'request failed' }
  } catch { return { error: 'Could not reach the server' } }
}
/** Like call(), but resolves null on any failure so the UI keeps working offline. */
const api = async <T = Me>(method: string, path: string, body?: unknown): Promise<T | null> => (await call<T>(method, path, body)).data ?? null

const sizeMb = (id: number) => (GAMES.find(g => g.id === id)?.sizeGb ?? 1) * 1024

class Store {
  // server-backed
  owned: number[] = [11]
  wishlist: number[] = []
  cart: number[] = []
  wallet = 5000
  installed: number[] = []
  favorites: number[] = []
  lastPlayed: Record<number, number> = {}
  playtime: Record<number, number> = {}
  status: Friend['status'] = 'online'
  name = 'Player'
  chats: Record<string, ChatMessage[]> = {}
  friends: Friend[] = FRIENDS
  // local (per browser)
  settings: Settings = DEFAULT_SETTINGS
  customGames: CustomGame[] = []
  hints: Record<string, boolean> = {}
  readNotifs: string[] = []
  posts: Record<number, { text: string; at: number }[]> = {}
  shelves: Shelf[] = ['whatsnew', 'recent']
  libraryGrid = false
  installedOnly = false
  recentSort = false
  groups: GroupChat[] = []
  viewed: number[] = []
  // session
  queue: DownloadItem[] = []
  speedHistory: number[] = []
  peakSpeed = 0
  completed: { id: number; at: number }[] = []
  running: number | null = null
  openChats: string[] = []
  typing: Record<string, boolean> = {}
  toasts: Toast[] = []
  friendsOpen = false

  constructor() {
    Object.assign(this, readJson<Partial<Saved>>(KEY, {}))
    const local = readJson<Partial<LocalState>>(LOCAL, {})
    Object.assign(this, local, { settings: { ...DEFAULT_SETTINGS, ...(local.settings ?? {}) } })
    makeAutoObservable(this)
    void this.hydrate()
    void this.refreshFriends()
    setInterval(() => { if (this.friends.some(f => f.status === 'pending')) void this.refreshFriends() }, 4000)
    setInterval(() => this.tickDownloads(), 250)
    autorun(() => {
      const s: Saved = {
        owned: this.owned, wishlist: this.wishlist, cart: this.cart, wallet: this.wallet, installed: this.installed,
        favorites: this.favorites, lastPlayed: this.lastPlayed, playtime: this.playtime, chats: this.chats, status: this.status, name: this.name,
      }
      const l: LocalState = {
        settings: this.settings, customGames: this.customGames, hints: this.hints, readNotifs: this.readNotifs, posts: this.posts,
        shelves: this.shelves, libraryGrid: this.libraryGrid, installedOnly: this.installedOnly, recentSort: this.recentSort, groups: this.groups, viewed: this.viewed,
      }
      try { localStorage.setItem(KEY, JSON.stringify(s)); localStorage.setItem(LOCAL, JSON.stringify(l)) } catch { /* storage unavailable */ }
    })
    autorun(() => {
      // everything is sized in px, so scale with zoom and tell the layout how tall the zoomed window may be
      document.body.style.zoom = String(this.settings.uiScale)
      document.documentElement.style.setProperty('--ui-scale', String(this.settings.uiScale))
      document.documentElement.classList.toggle('reduce-motion', this.settings.reduceMotion)
    })
  }

  // ---- derived ----
  get ownedGames() { return GAMES.filter(g => this.owned.includes(g.id)) }
  get cartGames() { return GAMES.filter(g => this.cart.includes(g.id)) }
  get cartTotal() { return this.cartGames.reduce((n, g) => n + priceOf(g), 0) }
  get wishlistGames() { return GAMES.filter(g => this.wishlist.includes(g.id)) }
  get activeDownload() { return this.queue.find(d => !d.paused) }
  get friendCode() { return String([...SESSION].reduce((h, c) => (h * 33 + c.charCodeAt(0)) % 2_000_000_000, 5381) + 1_000_000_000) }
  get storageUsedGb() { return this.installed.reduce((n, id) => n + sizeMb(id) / 1024, 0) }

  get notifications() {
    const list: { id: string; text: string; at: number }[] = [{ id: 'welcome', text: 'Welcome to reSteam! Browse the store or redeem a product code with "Add a Game".', at: 0 }]
    for (const g of this.wishlistGames) if (g.discount > 0) list.push({ id: `sale-${g.id}`, text: `${g.title} on your wishlist is ${g.discount}% off`, at: 1 })
    for (const c of this.completed) list.push({ id: `dl-${c.id}-${c.at}`, text: `${GAMES.find(g => g.id === c.id)?.title ?? 'A game'} finished installing`, at: c.at })
    for (const f of this.friends) if (f.custom && f.status !== 'pending') list.push({ id: `fr-${f.id}`, text: `${f.name} accepted your friend request`, at: 2 })
    return list.sort((a, b) => b.at - a.at)
  }
  get unreadCount() { return this.notifications.filter(n => !this.readNotifs.includes(n.id)).length }
  markAllRead() { this.readNotifs = this.notifications.map(n => n.id) }

  toast(text: string) {
    const id = Date.now() + Math.random()
    this.toasts.push({ id, text })
    setTimeout(() => runInAction(() => { this.toasts = this.toasts.filter(t => t.id !== id) }), 3500)
  }

  // ---- server sync ----
  private apply(m: Me) {
    this.owned = m.owned; this.wishlist = m.wishlist; this.cart = m.cart; this.wallet = m.wallet
    this.installed = m.installed; this.favorites = m.favorites; this.lastPlayed = m.lastPlayed
    this.playtime = m.playtime; this.status = m.status
    if (m.name) this.name = m.name
  }
  async hydrate() {
    const m = await api('GET', '/me')
    if (m) runInAction(() => this.apply(m))
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
  toggleWishlist(id: number) {
    const had = this.wishlist.includes(id)
    this.wishlist = had ? this.wishlist.filter(x => x !== id) : [...this.wishlist, id]
    void this.sync(had ? 'DELETE' : 'PUT', `/wishlist/${id}`)
  }
  addToCart(id: number) {
    if (this.cart.includes(id) || this.owned.includes(id)) return
    this.cart.push(id)
    void this.sync('PUT', `/cart/${id}`)
  }
  removeFromCart(id: number) {
    this.cart = this.cart.filter(x => x !== id)
    void this.sync('DELETE', `/cart/${id}`)
  }
  addFunds(cents: number) { this.wallet += cents; void this.sync('POST', '/wallet', { cents }) }
  checkout(): boolean {
    if (this.cartTotal > this.wallet) return false
    this.wallet -= this.cartTotal
    this.owned.push(...this.cart)
    this.wishlist = this.wishlist.filter(id => !this.cart.includes(id))
    this.cart = []
    void this.sync('POST', '/checkout')
    return true
  }
  claimFree(id: number) {
    if (this.owned.includes(id)) return
    this.owned.push(id)
    void this.sync('POST', `/claim/${id}`)
  }
  async redeem(code: string): Promise<string | null> { return this.sync('POST', '/redeem', { code }) }
  async gift(friendId: string, cents: number): Promise<string | null> {
    const err = await this.sync('POST', '/gift', { friendId, cents })
    if (!err) void this.loadChat(friendId)
    return err
  }

  view(id: number) { this.viewed = [id, ...this.viewed.filter(x => x !== id)].slice(0, 12) }

  // ---- library ----
  toggleFavorite(id: number) {
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
    this.customGames.push({ id: 1000 + this.customGames.length + 1, title: t })
    this.toast(`${t} was added to your library`)
  }
  post(gameId: number, text: string) {
    const t = text.trim().slice(0, 300)
    if (t) (this.posts[gameId] ??= []).unshift({ text: t, at: Date.now() })
  }

  // ---- downloads (single active download, the rest queue) ----
  install(id: number) {
    if (this.installed.includes(id) || this.queue.some(d => d.id === id)) return
    this.queue.push({ id, progress: 0, phase: 'Starting Download', speed: 0, paused: false })
  }
  pause(id: number) { const d = this.queue.find(x => x.id === id); if (d) { d.paused = true; d.speed = 0 } }
  resume(id: number) { const d = this.queue.find(x => x.id === id); if (d) d.paused = false }
  cancel(id: number) { this.queue = this.queue.filter(d => d.id !== id) }
  moveToFront(id: number) {
    const d = this.queue.find(x => x.id === id)
    if (d) this.queue = [d, ...this.queue.filter(x => x.id !== id)]
  }
  /** A real game is ~GBs; compress time so an install takes 8-40s, while the shown speed still reflects the limit. */
  private tickDownloads() {
    const d = this.activeDownload
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

  private tick?: ReturnType<typeof setInterval>
  play(id: number) {
    if (this.running !== null) return
    this.running = id
    this.lastPlayed[id] = Date.now()
    this.tick = setInterval(() => runInAction(() => {
      this.playtime[id] = (this.playtime[id] ?? 0) + 1
      this.lastPlayed[id] = Date.now()
      if (id < 1000) void api('POST', `/playtime/${id}`, { minutes: 1 })
    }), 6000) // one "minute" per 6s so playtime visibly moves
  }
  stop() { clearInterval(this.tick); this.running = null }

  // ---- profile / friends / chat ----
  setStatus(status: Friend['status']) { this.status = status; void this.sync('PUT', '/status', { status }) }
  async setName(name: string): Promise<string | null> {
    const { data, error } = await call<Me>('PUT', '/profile', { name })
    if (error || !data) return error ?? 'Could not save name'
    runInAction(() => this.apply(data))
    return null
  }
  signOut() {
    try { localStorage.removeItem('resteam:session'); localStorage.removeItem(KEY); localStorage.removeItem(LOCAL) } catch { /* ignore */ }
    SESSION = crypto.randomUUID()
    try { localStorage.setItem('resteam:session', SESSION) } catch { /* ignore */ }
    location.hash = '#/store'
    location.reload()
  }
  async refreshFriends() {
    const list = await api<Friend[]>('GET', '/friends')
    if (list) runInAction(() => { this.friends = list })
  }
  async addFriend(name: string): Promise<string | null> {
    const { data, error } = await call<Friend>('POST', '/friends', { name })
    if (error || !data) return error ?? 'Could not add friend'
    runInAction(() => { this.friends = [...this.friends, data] })
    return null
  }
  async removeFriend(id: string) {
    this.closeChat(id)
    this.friends = this.friends.filter(f => f.id !== id)
    await api('DELETE', `/friends/${id}`)
  }
  async loadChat(id: string) {
    const history = await api<ChatMessage[]>('GET', `/chats/${id}`)
    if (history) runInAction(() => { this.chats[id] = history })
  }
  async openChat(id: string) {
    if (this.openChats.includes(id)) return
    this.openChats.push(id)
    if (!id.startsWith('g')) await this.loadChat(id) // group chats live only in this browser
  }
  closeChat(id: string) { this.openChats = this.openChats.filter(x => x !== id) }
  send(friendId: string, text: string) {
    const t = text.trim()
    if (!t) return
    ;(this.chats[friendId] ??= []).push({ from: 'me', text: t, at: Date.now() })
    const f = this.friends.find(x => x.id === friendId)
    if (!f || f.status === 'offline') { void api('POST', `/chats/${friendId}`, { text: t }); return }
    this.typing[friendId] = true
    void api<{ reply: ChatMessage | null }>('POST', `/chats/${friendId}`, { text: t }).then(res => {
      const reply = res?.reply ?? { from: friendId, text: BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)], at: Date.now() }
      setTimeout(() => runInAction(() => { this.typing[friendId] = false; (this.chats[friendId] ??= []).push(reply) }), 1200 + Math.random() * 1500)
    })
  }

  // ---- group chats (kept on this browser; members answer with canned replies) ----
  createGroup(name: string, members: string[]) {
    const id = `g${Date.now()}`
    this.groups.push({ id, name: name.trim().slice(0, 30) || 'Group chat', members, messages: [] })
    this.openChat(id)
  }
  deleteGroup(id: string) { this.closeChat(id); this.groups = this.groups.filter(g => g.id !== id) }
  sendGroup(id: string, text: string) {
    const t = text.trim().slice(0, 500)
    const grp = this.groups.find(g => g.id === id)
    if (!t || !grp) return
    grp.messages.push({ from: 'me', text: t, at: Date.now() })
    const online = grp.members.filter(m => { const f = this.friends.find(x => x.id === m); return f && f.status !== 'offline' && f.status !== 'pending' })
    if (online.length === 0) return
    this.typing[id] = true
    setTimeout(() => runInAction(() => {
      this.typing[id] = false
      const from = online[Math.floor(Math.random() * online.length)]
      grp.messages.push({ from, text: BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)], at: Date.now() })
    }), 1200 + Math.random() * 1500)
  }

  news = NEWS
}

export const store = new Store()
