import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { ALL_TAGS, GAMES, GENRES, compact, fmt, priceOf, reviewLabel, type Game } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Avatar, Modal, Price, useDismiss } from './ui'
import { MegaNav } from './MegaMenu'
import { t as tr } from './i18n'
import './store.css'

export const reviewClass = (rating: number, reviews = 1) => (reviews < 10 ? 'rv-none' : rating >= 70 ? 'rv-pos' : rating >= 40 ? 'rv-mixed' : 'rv-neg')

/* ---------- layout with the store sub-menu ---------- */
const SearchBox = observer(() => {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const hits = q.trim() ? GAMES.filter(g => g.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : []
  return (
    <div className="ssearch popwrap" ref={ref}>
      <form className="ssearch-form" onSubmit={e => { e.preventDefault(); setOpen(false); nav(`/store/browse?q=${encodeURIComponent(q.trim())}`) }}>
      <input placeholder={tr('search.ph')} value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} aria-label={tr('search.ph')} />
      <button className="ssearch-btn" aria-label="Search"><Icon name="search" size={22} /></button>
      </form>
      {open && hits.length > 0 && (
        <div className="popover suggest" style={{ left: 0, right: 0, minWidth: 0 }}>
          {hits.map(g => (
            <Link key={g.id} to={`/store/${g.id}`} className="sug-row" onClick={() => { setOpen(false); setQ('') }}>
              <div className="sug-art"><Art game={g} kind="header" showTitle={false} /></div>
              <span className="grow">{g.title}</span><Price game={g} />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
})

export const StoreLayout = observer(() => {
  const flat = useLocation().pathname !== '/store'
  return (
  <div className="store">
    <MegaNav><SearchBox /></MegaNav>
    <div className={`store-page ${flat ? 'flat' : ''}`}><Outlet /></div>
  </div>
  )
})

/* ---------- small shared pieces ---------- */
export const Tags = ({ g, n = 4 }: { g: Game; n?: number }) => (
  <div className="tagrow">{g.tags.slice(0, n).map(t => <Link key={t} to={`/store/browse?tag=${encodeURIComponent(t)}`} className="tagchip">{t}</Link>)}</div>
)

const Card = ({ g }: { g: Game }) => (
  <Link to={`/store/${g.id}`} className="scard">
    <div className="scard-art"><Art game={g} kind="header" /></div>
    <div className="scard-body"><div className="scard-title">{g.title}</div><Tags g={g} n={2} /><Price game={g} /></div>
  </Link>
)

/* ---------- gift card modal ---------- */
const GiftModal = observer(({ onClose }: { onClose: () => void }) => {
  const pals = store.friends
  const [friend, setFriend] = useState(pals[0]?.username ?? '')
  const [amount, setAmount] = useState(1000)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal title="Send a Gift Card" onClose={onClose}>
      <p>Send wallet funds to a friend. The amount comes out of your balance ({fmt(store.wallet)}).</p>
      {pals.length === 0 && <p className="muted small">You need a friend to send a gift card to. Add one from Friends &amp; Chat.</p>}
      <label className="small muted">Friend</label>
      <select className="input" value={friend} onChange={e => setFriend(e.target.value)}>{pals.map(f => <option key={f.username} value={f.username}>{f.name}</option>)}</select>
      <div className="amounts">{[500, 1000, 2500, 5000, 10000].map(a => <button key={a} className={`btn ${amount === a ? 'blue' : ''}`} onClick={() => setAmount(a)}>{fmt(a)}</button>)}</div>
      {err && <div className="err">{err}</div>}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn green" disabled={!friend || busy} onClick={async () => {
          setBusy(true); const e = await store.gift(friend, amount); setBusy(false)
          if (e) setErr(e); else { store.toast(`Gift card sent to ${pals.find(f => f.username === friend)?.name}`); onClose() }
        }}>Send gift card</button>
      </div>
    </Modal>
  )
})

/* ---------- store home (mirrors the real storefront's sections) ---------- */
/** Capsule price row: lime discount, struck-through original, dark final price. */
export const CapPrice = ({ g }: { g: Game }) => (
  <div className="cap-price">
    {g.discount > 0 && <span className="cp-off">-{g.discount}%</span>}
    <span className="cp-final">{g.discount > 0 && <s>{fmt(g.price)}</s>}<b>{fmt(priceOf(g))}</b></span>
  </div>
)

const Arrows = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => (
  <>
    <button className="out-arrow l" onClick={onPrev} aria-label="Previous"><Icon name="chevronLeft" size={44} /></button>
    <button className="out-arrow r" onClick={onNext} aria-label="Next"><Icon name="chevronRight" size={44} /></button>
  </>
)
const Dots = ({ n, i, set }: { n: number; i: number; set: (i: number) => void }) => (
  <div className="dots">{Array.from({ length: n }, (_, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => set(k)} aria-label={`Page ${k + 1}`} />)}</div>
)
const Head = ({ title, more, children }: { title: string; more?: string; children?: React.ReactNode }) => (
  <div className="sec-head2"><h2>{title}{children}</h2>{more && <Link to={more} className="seebtn">{tr('home.seemore')}</Link>}</div>
)

const DevBanner = () => (
  <Link to="/developer" className="promo" aria-label="Upload your game">
    <svg viewBox="0 0 1200 190" preserveAspectRatio="xMidYMid slice" className="promo-svg">
      <defs><linearGradient id="dvb" x1="0" x2="1"><stop offset="0" stopColor="#173a5e" /><stop offset=".55" stopColor="#1e5a8a" /><stop offset="1" stopColor="#2a2f6e" /></linearGradient></defs>
      <rect width="1200" height="190" fill="url(#dvb)" />
      {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={(i * 131) % 1200} cy={((i * 71) % 170) + 10} r={3 + (i % 4) * 2} fill="#ffffff" opacity={0.06 + (i % 3) * 0.03} />)}
      <text x="60" y="78" fontSize="30" fontWeight="700" fill="#9fd4ff" fontStyle="italic">reSteam Create</text>
      <text x="58" y="146" fontSize="64" fontWeight="800" fill="#fff">Publish your game</text>
      <rect x="760" y="64" width="380" height="64" rx="32" fill="#1a9fff" />
      <text x="950" y="105" textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff">PLAY IN THE BROWSER OR DOWNLOAD</text>
    </svg>
  </Link>
)

export const StoreHome = observer(() => {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [gift, setGift] = useState(false)
  const [dPage, setDPage] = useState(0)
  const [nPage, setNPage] = useState(0)
  const [tab, setTab] = useState<'new' | 'top' | 'upcoming' | 'sale' | 'free'>('new')
  const [hover, setHover] = useState<Game | null>(null)
  const pool = GAMES.filter(g => !store.ignored.includes(g.id))
  const featured = useMemo(() => [...pool].sort((a, b) => b.reviews * b.rating - a.reviews * a.rating || b.owners - a.owners || b.discount - a.discount).slice(0, 8), [store.ignored.length, GAMES.reduce((n, g) => n + g.reviews, 0)])
  const sale = useMemo(() => pool.filter(g => g.discount > 0).sort((a, b) => b.discount - a.discount), [pool.length])
  const hero = sale.slice(0, 3)
  const f = featured[idx]
  const maxOff = Math.max(...GAMES.map(g => g.discount))
  const byReviews = useMemo(() => [...pool].sort((a, b) => b.reviews - a.reviews || b.owners - a.owners), [pool.length, GAMES.reduce((n, g) => n + g.reviews + g.owners, 0)])
  const newest = useMemo(() => [...pool].sort((a, b) => b.released.localeCompare(a.released)), [pool.length])
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const freeGames = pool.filter(g => g.price === 0)
  const tags = useMemo(() => {
    const c = new Map<string, number>()
    GAMES.forEach(g => g.tags.forEach(t => c.set(t, (c.get(t) ?? 0) + 1)))
    const ok = [...c.entries()].filter(([t, n]) => n >= 4 && !['Free to Play', 'Multiplayer', 'Singleplayer'].includes(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t)
    const first = ok[0]
    const set = (t: string) => new Set(GAMES.filter(g => g.tags.includes(t)).map(g => g.id))
    const a = set(first)
    // second tag: the popular one that shares the fewest games with the first
    const second = ok.slice(1).sort((x, y) => [...set(x)].filter(i => a.has(i)).length - [...set(y)].filter(i => a.has(i)).length)[0]
    return [first, second].filter(Boolean)
  }, [])
  const tabList = tab === 'new' ? newest : tab === 'top' ? byReviews : tab === 'sale' ? sale : tab === 'free' ? freeGames : [...GAMES].sort((a, b) => b.rating - a.rating)
  const shown = hover ?? tabList[0]
  const dealsPages = [
    { big: hero[0], free: freeGames[0], deals: [sale[3], sale[4]] },
    { big: hero[1], free: freeGames[1] ?? freeGames[0], deals: [sale[5], sale[6]] },
  ]
  const dp = dealsPages[dPage]
  const rank = byReviews.findIndex(g => g.id === f.id) + 1

  useEffect(() => {
    if (paused || store.settings.reduceMotion) return
    const t = setInterval(() => setIdx(i => (i + 1) % featured.length), 6000)
    return () => clearInterval(t)
  }, [paused, featured.length])
  useEffect(() => { if (idx >= featured.length) setIdx(0) }, [idx, featured.length])

  return (
    <div className="shome">
      <section className="hero-banner" style={{ ['--h' as string]: hero[0].hue }}>
        <div className="hb-left"><Art game={hero[0]} kind="hero" showTitle={false} variant={1} /></div>
        <div className="hb-body">
          <div className="hb-head"><div className="hb-mark">reSteam</div><div className="hb-sep" /><div className="hb-title">WEEKEND SALE</div></div>
          <div className="hb-caps">
            {hero.map((g, i) => (
              <Link key={g.id} to={`/store/${g.id}`} className={`hb-cap c${i}`}><Art game={g} kind="tile" /><span className="hb-badge">-{g.discount}%</span></Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container sec">
        <div className="sec-head2">
          <h2>{tr('home.featured')}</h2>
          <button className="giftbtn" onClick={() => setGift(true)}><span className="giftart"><Icon name="gift" size={26} /></span> {tr('home.gift')}</button>
        </div>
        <div className="feat-wrap" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <button className="peek l" onClick={() => setIdx((idx + featured.length - 1) % featured.length)} aria-label="Previous featured game"><Art game={featured[(idx + featured.length - 1) % featured.length]} kind="wide" showTitle={false} /><Icon name="chevronLeft" size={44} /></button>
          <button className="peek r" onClick={() => setIdx((idx + 1) % featured.length)} aria-label="Next featured game"><Art game={featured[(idx + 1) % featured.length]} kind="wide" showTitle={false} /><Icon name="chevronRight" size={44} /></button>
          <div className="feat">
            <Link to={`/store/${f.id}`} className="feat-main feat-fade" key={f.id}><Art game={f} kind="wide" variant={idx % 3} /></Link>
            <div className="feat-panel">
              <div className="fp-title">{f.title}</div>
              <div className="fp-rev"><span className={reviewClass(f.rating, f.reviews)}>{reviewLabel(f.rating, f.reviews)}</span> {f.reviews >= 10 && <span className="muted">({compact(f.reviews)} Reviews)</span>}</div>
              <div className="fp-shots">{[1, 2, 3, 4].map(n => <div key={n} className="fp-shot"><Art game={f} kind="shot" variant={n} showTitle={false} /></div>)}</div>
              <div className="fp-rank"><svg width="40" height="34" viewBox="0 0 40 34" aria-hidden><path d="M2 20l9-9 7 6 14-14" fill="none" stroke="#a4d007" strokeWidth="3" /><rect x="4" y="22" width="7" height="11" fill="#fff" /><rect x="15" y="16" width="7" height="17" fill="#fff" /><rect x="26" y="9" width="7" height="24" fill="#fff" /></svg>
                <div><div className="rk-t">{f.reviews > 0 ? (rank <= 3 ? 'Top Rated' : 'Popular') : 'Just added'}</div><div>{f.reviews > 0 ? `Ranked #${rank} by player reviews` : 'Be the first to review it'}</div></div></div>
              <div className="fp-foot">{f.price === 0 ? <span className="fp-free">Free to Play</span> : <CapPrice g={f} />}</div>
            </div>
          </div>
        </div>
        <Dots n={featured.length} i={idx} set={setIdx} />
      </section>

      <section className="container"><DevBanner /></section>

      <section className="container sec">
        <Head title={tr('home.discounts')} more="/store/browse?sale=1" />
        <div className="feat-wrap">
          <Arrows onPrev={() => setDPage((dPage + 1) % 2)} onNext={() => setDPage((dPage + 1) % 2)} />
          <div className="events">
            <Link to="/store/browse?sale=1" className="ev big">
              <span className="evtag t-purple">WEEKEND SALE</span>
              <div className="ev-art split">
                <div className="ev-top"><Art game={dp.big} kind="wide" variant={1} /></div>
                <div className="ev-bottom"><div className="ev-brand">reSteam <b>WEEKEND SALE</b></div><div className="ev-thumbs">{sale.slice(0, 3).map(g => <div key={g.id} className="ev-thumb"><Art game={g} kind="header" /></div>)}</div></div>
              </div>
              <div className="ev-price"><span className="up-to">Up to -{maxOff}%</span></div>
            </Link>
            <Link to={`/store/${dp.free.id}`} className="ev">
              <span className="evtag t-purple">FREE TO PLAY</span>
              <div className="ev-art tall"><Art game={dp.free} kind="capsule" /></div>
              <div className="ev-price"><CapPrice g={dp.free} /></div>
            </Link>
            <div className="ev stack">
              {dp.deals.map(g => (
                <Link key={g.id} to={`/store/${g.id}`} className="ev half">
                  <span className="evtag t-blue">SPECIAL OFFER</span>
                  <div className="ev-art short"><Art game={g} kind="header" /></div>
                  <div className="ev-price"><CapPrice g={g} /></div>
                </Link>
              ))}
            </div>
          </div>
        </div>
        <Dots n={2} i={dPage} set={setDPage} />
      </section>

      <section className="container">
        <div className="queue">
          <div className="q-text">
            <h3>Explore Your Discovery Queue</h3>
            <p>{store.signedIn ? 'Browse popular, new and recommended titles picked for you.' : 'Sign in to discover top-selling, new and recommended titles.'}</p>
            {store.signedIn ? <Link to="/explore" className="btn bright">Start exploring</Link> : <Link to="/login?next=/explore" className="btn bright">Sign in</Link>}
          </div>
          <div className="q-shots">{[2, 4, 6].map((v, i) => <div key={v} className={`q-shot s${i}`}><Art game={byReviews[i]} kind="shot" variant={v} showTitle={false} /></div>)}</div>
        </div>
      </section>

      <section className="container two-col sec">
        {tags.map((t, ti) => {
          const used = new Set(tags.slice(0, ti).flatMap(x => GAMES.filter(g => g.tags.includes(x)).slice(0, 4).map(g => g.id)))
          const list = GAMES.filter(g => g.tags.includes(t) && !used.has(g.id)).slice(0, 4)
          return (
            <div key={t}>
              <h2 className="tag-title">{t.toUpperCase()} GAMES</h2><div className="tag-sub">Featured tag</div>
              <div className="tag-panel">{list.map(g => <Link key={g.id} to={`/store/${g.id}`} className="tg"><div className="tg-art"><Art game={g} kind="header" /></div><CapPrice g={g} /></Link>)}</div>
              <div className="seerow"><Link to={`/store/browse?tag=${encodeURIComponent(t)}`} className="seebtn">{tr('home.seemore')}</Link></div>
            </div>
          )
        })}
      </section>

      <section className="container sec newrel">
        <Head title={tr('home.newrel')} more="/store/browse?sort=new"><span className="monthchip">{month}</span></Head>
        <div className="feat-wrap">
          <Arrows onPrev={() => setNPage((nPage + 2) % 3)} onNext={() => setNPage((nPage + 1) % 3)} />
          <div className="nr-panel">
            {newest.slice(nPage * 4, nPage * 4 + 4).map(g => (
              <Link key={g.id} to={`/store/${g.id}`} className="nr"><div className="nr-art"><Art game={g} kind="wide" /></div><CapPrice g={g} /></Link>
            ))}
            <Dots n={3} i={nPage} set={setNPage} />
          </div>
        </div>
      </section>

      <section className="container sec">
        <div className="tabs-real">
          {([['new', 'Popular New Releases'], ['top', 'Top Sellers'], ['upcoming', 'Popular Upcoming'], ['sale', 'Specials'], ['free', 'Trending Free']] as const).map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setHover(null) }}>{l}</button>
          ))}
        </div>
        <div className="tab-grid">
          <div className="list">{tabList.slice(0, 10).map(g => (
            <Link key={g.id} to={`/store/${g.id}`} className={`lrow ${shown.id === g.id ? 'hov' : ''}`} onMouseEnter={() => setHover(g)}>
              <div className="lrow-art"><Art game={g} kind="header" /></div>
              <div className="lrow-main"><div className="lrow-title">{g.title}</div><Tags g={g} n={3} /></div>
              <CapPrice g={g} />
            </Link>))}
          </div>
          <aside className="preview">
            <div className="pv-title">{shown.title}</div>
            <div className="muted small">Released: {new Date(shown.released).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div className="fp-shots">{[1, 2, 3, 4].map(n => <div key={n} className="fp-shot"><Art game={shown} kind="shot" variant={n} showTitle={false} /></div>)}</div>
            <div><span className={reviewClass(shown.rating, shown.reviews)}>{reviewLabel(shown.rating, shown.reviews)}</span>{shown.reviews >= 10 && <span className="muted small"> ({compact(shown.reviews)})</span>}</div>
            <Tags g={shown} n={4} />
          </aside>
        </div>
      </section>

      <section className="container sec">
        <Head title={tr('home.free')} more="/store/browse?free=1" />
        <div className="cards">{freeGames.map(g => <Card key={g.id} g={g} />)}</div>
      </section>

      <section className="container sec">
        <h2>{tr('home.genre')}</h2>
        <div className="genres">
          {GENRES.map((gn, i) => {
            const g = GAMES.find(x => x.genre.includes(gn))!
            return <Link key={gn} to={`/store/browse?genre=${encodeURIComponent(gn)}`} className="gtile"><Art game={g} kind="header" variant={i % 4} showTitle={false} /><span>{gn}</span></Link>
          })}
        </div>
      </section>
      {gift && <GiftModal onClose={() => setGift(false)} />}
    </div>
  )
})

/* ---------- shared bits for list pages ---------- */
export const Plats = () => (
  <span className="plats" aria-label="Windows and macOS">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden><rect x="1" y="1" width="6.5" height="6.5" /><rect x="8.5" y="1" width="6.5" height="6.5" /><rect x="1" y="8.5" width="6.5" height="6.5" /><rect x="8.5" y="8.5" width="6.5" height="6.5" /></svg>
    <svg width="17" height="16" viewBox="0 0 17 16" fill="currentColor" aria-hidden><path d="M2 2h13v9H2z" opacity=".9" /><path d="M0 12.5h17v1.5H0z" /></svg>
  </span>
)

/** Result-row price: lime discount block over struck price and lime final price; plain white when not discounted. */
export const SearchPrice = ({ g }: { g: Game }) => g.discount > 0 ? (
  <div className="sp-disc"><span className="sp-pct">-{g.discount}%</span><span className="sp-stack"><s>{fmt(g.price)}</s><b>{fmt(priceOf(g))}</b></span></div>
) : <div className="sp-plain">{fmt(g.price)}</div>

const Panel = ({ title, open0 = false, children }: { title: string; open0?: boolean; children?: React.ReactNode }) => {
  const [open, setOpen] = useState(open0)
  return (
    <div className="npanel">
      <button className="nhead" onClick={() => setOpen(!open)} aria-expanded={open}>{title}</button>
      {open && <div className="nbody">{children}</div>}
    </div>
  )
}

/* ---------- browse / search results ---------- */
export const Browse = observer(() => {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const genre = sp.get('genre'), tag = sp.get('tag'), noTag = sp.get('notag'), sort = sp.get('sort') ?? 'relevance'
  const free = sp.get('free') === '1', sale = sp.get('sale') === '1', friends = sp.get('friends') === '1', hideFree = sp.get('hidefree') === '1'
  const maxSize = Number(sp.get('maxSize') ?? 0), minSize = Number(sp.get('minSize') ?? 0), under = Number(sp.get('under') ?? 0), minRating = Number(sp.get('minRating') ?? 0)
  const [draft, setDraft] = useState(q)
  const [tagQ, setTagQ] = useState('')
  useEffect(() => setDraft(q), [q])
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null || v === '') n.delete(k); else n.set(k, v); setSp(n) }

  const ignored = new Set(store.ignored)
  const showIgnored = sp.get('ignored') === '1'
  const base = GAMES.filter(g =>
    (showIgnored ? ignored.has(g.id) : !ignored.has(g.id)) && (!sp.get('followed') || store.followed.includes(g.id)) &&
    (!q || g.title.toLowerCase().includes(q.toLowerCase()) || g.dev.toLowerCase().includes(q.toLowerCase()) || g.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))) &&
    (!genre || g.genre.includes(genre)) && (!free || g.price === 0) && (!sp.get('playable') || g.playable) && (!sp.get('download') || !!g.build) && (!sp.get('user') || g.user) && (!hideFree || g.price > 0) && (!sale || g.discount > 0) &&
    (!maxSize || g.sizeGb <= maxSize) && (!minSize || g.sizeGb >= minSize) && (!under || priceOf(g) <= under) && (!minRating || g.rating >= minRating) &&
    (!friends || store.friends.some(f => f.presence.gameId === g.id)) && (!noTag || !g.tags.includes(noTag)))
  const list = [...base.filter(g => !tag || g.tags.includes(tag))].sort((a, b) => sort === 'new' ? b.released.localeCompare(a.released) : sort === 'top' ? b.reviews - a.reviews : sort === 'price' ? priceOf(a) - priceOf(b) : sort === 'rating' ? b.rating - a.rating : b.reviews * b.rating - a.reviews * a.rating)
  const tagCounts = [...new Map(ALL_TAGS.map(t => [t, base.filter(g => g.tags.includes(t)).length])).entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const chips: [string, string][] = [['q', q && `"${q}"`], ['genre', genre ?? ''], ['tag', tag ?? ''], ['notag', noTag ? `not ${noTag}` : ''], ['free', free ? 'Free to Play' : ''], ['sale', sale ? 'Discounts & Events' : ''], ['hidefree', hideFree ? 'Hide free to play' : ''],
    ['friends', friends ? 'Played by friends' : ''], ['playable', sp.get('playable') ? 'Playable in the browser' : ''], ['download', sp.get('download') ? 'Downloadable' : ''], ['user', sp.get('user') ? 'Player uploads' : ''], ['maxSize', maxSize ? `Under ${maxSize} GB` : ''], ['minSize', minSize ? `Over ${minSize} GB` : ''], ['under', under ? `Under ${fmt(under)}` : ''], ['minRating', minRating ? `${minRating}%+ positive` : '']]
  const active = chips.filter(([, v]) => v)
  const rvIcon = (r: number, n: number) => reviewClass(r, n)

  return (
    <div className="container browse2">
      <div className="chips">{active.map(([k, v]) => <button key={k} className="fchip" onClick={() => set(k, null)}>{v} <span aria-hidden>⊗</span></button>)}</div>
      <div className="browse-grid">
        <div>
          <form className="sbar" onSubmit={e => { e.preventDefault(); set('q', draft.trim()) }}>
            <input value={draft} onChange={e => setDraft(e.target.value)} aria-label="Search" />
            <button className="sbtn">Search</button>
            <span className="grow" />
            <label className="sortlbl">Sort by
              <select value={sort} onChange={e => set('sort', e.target.value)} aria-label="Sort by">
                <option value="relevance">Relevance</option><option value="new">Release date</option><option value="top">Most reviews</option><option value="rating">User reviews</option><option value="price">Price</option>
              </select></label>
          </form>
          <div className="resinfo"><span>{list.length} result{list.length === 1 ? '' : 's'} match your search.{store.ignored.length > 0 && !showIgnored && ` ${store.ignored.length} title${store.ignored.length === 1 ? ' has' : 's have'} been excluded based on your preferences.`} {store.ignored.length > 0 && <button className="link-btn small" onClick={() => set('ignored', showIgnored ? null : '1')}>{showIgnored ? 'Back to results' : 'Show ignored'}</button>}</span></div>
          <div className="srows">
            {list.map(g => (
              <Link key={g.id} to={`/store/${g.id}`} className="srow">
                <div className="srow-art"><Art game={g} kind="header" /></div>
                <div className="srow-main"><div className="srow-title">{g.title}</div><Plats /></div>
                <div className="srow-date">{new Date(g.released).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <span className={`rvthumb ${rvIcon(g.rating, g.reviews)}`} title={g.reviews > 0 ? `${reviewLabel(g.rating, g.reviews)} (${compact(g.reviews)})` : 'No user reviews'}><Icon name="thumbUp" size={14} /></span>
                <SearchPrice g={g} />
              </Link>
            ))}
            {list.length === 0 && <p className="muted" style={{ padding: 16 }}>No results. Try removing a filter or <Link to="/store">go back to the store</Link>.</p>}
          </div>
        </div>
        <aside className="nside">
          <Panel title="Narrow by Price" open0>
            <input type="range" min={0} max={6000} step={500} value={under || 6000} onChange={e => set('under', Number(e.target.value) >= 6000 ? null : e.target.value)} aria-label="Maximum price" />
            <div className="anyprice">{under ? `Under ${fmt(under)}` : 'Any Price'}</div>
            <label className="chk"><input type="checkbox" checked={sale} onChange={() => set('sale', sale ? null : '1')} /> Discounts &amp; Events</label>
            <label className="chk"><input type="checkbox" checked={hideFree} onChange={() => set('hidefree', hideFree ? null : '1')} /> Hide free to play items</label>
          </Panel>
          <Panel title="Narrow by tag" open0>
            {tagCounts.filter(([t]) => t.toLowerCase().includes(tagQ.toLowerCase())).slice(0, tagQ ? 12 : 6).map(([t, n]) => (
              <div key={t} className="chk tagline"><label><input type="checkbox" checked={tag === t} onChange={() => set('tag', tag === t ? null : t)} /> {t} <i>{n}</i></label>
                <button className="excl" onClick={() => set('notag', noTag === t ? null : t)} aria-label={`Exclude ${t}`} title="Exclude">−</button></div>
            ))}
            <input className="tagsearch" placeholder="search for more tags" value={tagQ} onChange={e => setTagQ(e.target.value)} aria-label="Search tags" />
          </Panel>
          <Panel title="Narrow by genre">{GENRES.map(g => <label key={g} className="chk"><input type="checkbox" checked={genre === g} onChange={() => set('genre', genre === g ? null : g)} /> {g} <i>{GAMES.filter(x => x.genre.includes(g)).length}</i></label>)}</Panel>
          <Panel title="Narrow by number of players">{['Singleplayer', 'Multiplayer', 'Co-op', 'Local Multiplayer'].map(t => <label key={t} className="chk"><input type="checkbox" checked={tag === t} onChange={() => set('tag', tag === t ? null : t)} /> {t}</label>)}</Panel>
          <Panel title="Narrow by user reviews">{[95, 80, 70].map(r => <label key={r} className="chk"><input type="checkbox" checked={minRating === r} onChange={() => set('minRating', minRating === r ? null : String(r))} /> {r}% or higher</label>)}</Panel>
        </aside>
      </div>
    </div>
  )
})

/* ---------- cart ---------- */
const PayModal = observer(({ onClose, onDone }: { onClose: () => void; onDone: (ids: number[]) => void }) => {
  const [err, setErr] = useState('')
  const short = store.cartTotal > store.wallet
  return (
    <Modal title="Payment method" onClose={onClose} width={480}>
      <div className="paybox"><Icon name="card" size={34} /><div className="grow"><b>reSteam Wallet</b><div className="muted small">Balance {fmt(store.wallet)}</div></div><b>{fmt(store.cartTotal)}</b></div>
      {short && <div className="err small">You need {fmt(store.cartTotal - store.wallet)} more. <button className="link-btn" onClick={() => void store.addFunds(2000)}>Add {fmt(2000)} to wallet</button></div>}
      {err && <div className="err">{err}</div>}
      <p className="muted small">A purchase of a digital product grants a license for the product on reSteam.</p>
      <div className="modal-actions"><button className="btn" onClick={onClose}>Back</button>
        <button className="btn green" disabled={short} onClick={async () => { const ids = store.cart.slice(); const e = await store.checkout(); if (e) setErr(e); else onDone(ids) }}>Purchase</button></div>
    </Modal>
  )
})

export const Cart = observer(() => {
  const nav = useNavigate()
  const [done, setDone] = useState<number[] | null>(null)
  const [pay, setPay] = useState(false)
  const recs = useMemo(() => [...GAMES].filter(g => !store.owned.includes(g.id) && !store.cart.includes(g.id)).sort((a, b) => b.discount - a.discount || b.rating - a.rating).slice(0, 3), [store.owned.length, store.cart.length])
  if (done) {
    const gs = GAMES.filter(g => done.includes(g.id))
    return (
      <div className="container cart2">
        <h1 className="cart-h1">Thank you for your purchase!</h1>
        <p className="muted">Your new games have been added to your library.</p>
        {gs.map(g => <div key={g.id} className="cart-item"><div className="ci-art"><Art game={g} kind="header" /></div><div className="grow"><b>{g.title}</b></div>
          <button className="btn blue" onClick={() => { store.install(g.id); nav('/downloads') }}>Install</button></div>)}
        <p><Link to="/library" className="btn green">Go to my library</Link></p>
      </div>
    )
  }
  const empty = store.cartGames.length === 0
  return (
    <div className="container cart2">
      <div className="crumbs2"><Link to="/store">Home</Link> &gt; <span>Your Shopping Cart</span></div>
      <h1 className="cart-h1">{tr('cart.title')}</h1>
      <div className="cart-grid2">
        <div>
          <div className="cart-box">
            {empty ? <div className="cart-empty">{tr('cart.empty')}</div> : store.cartGames.map(g => (
              <div className="cart-item" key={g.id}>
                <div className="ci-art"><Art game={g} kind="header" /></div>
                <div className="grow"><Link to={`/store/${g.id}`} className="ci-title">{g.title}</Link><div className="muted small"><Plats /> {g.sizeGb.toFixed(1)} GB</div></div>
                <Price game={g} /><button className="link-btn" onClick={() => store.removeFromCart(g.id)}>Remove</button>
              </div>))}
          </div>
          <div className="cart-btns">
            <Link to="/store" className="btn gray">{tr('cart.continue')}</Link>
            <button className="btn bluebig" disabled={empty} onClick={() => setPay(true)}>{tr('cart.pay')}</button>
          </div>
          <h3 className="rec-title">RECOMMENDATIONS FOR YOU</h3>
          <div className="rec3">{recs.map((g, i) => (
            <Link key={g.id} to={`/store/${g.id}`} className="rec"><div className="rec-art"><Art game={g} kind="header" /></div>
              <div className="rec-pill"><span className="rec-plats"><Plats /></span>{i < 2 && <span className="rec-new">NEW</span>}
                {g.discount > 0 ? <><span className="rec-pct">-{g.discount}%</span><span className="rec-price"><s>{fmt(g.price)}</s><b>{fmt(priceOf(g))}</b></span></> : <span className="rec-price plain"><b>{fmt(g.price)}</b></span>}</div></Link>))}</div>
        </div>
        <aside className="cart-side">
          <div className="est"><b>{tr('cart.total')}</b><div className="est-total">{fmt(store.cartTotal)}</div><div className="small">Sales tax will be calculated during checkout where applicable</div>
            <button className="btn bluebig full" disabled={empty} onClick={() => setPay(true)}>{tr('cart.pay')}</button></div>
          <div className="cart-ill">
            <svg viewBox="0 0 300 150" aria-hidden><rect x="60" y="20" width="190" height="110" rx="4" fill="#0f1722" stroke="#33465c" /><rect x="70" y="30" width="60" height="90" fill="#17222f" /><rect x="136" y="30" width="104" height="52" fill="#2b3f66" /><rect x="136" y="90" width="104" height="8" fill="#1d2b3d" /><rect x="136" y="104" width="70" height="8" fill="#1d2b3d" /></svg>
            <p>A purchase of a digital product grants a license for the product on reSteam.</p>
          </div>
        </aside>
      </div>
      {pay && <PayModal onClose={() => setPay(false)} onDone={ids => { setPay(false); setDone(ids) }} />}
    </div>
  )
})

/* ---------- wishlist ---------- */
export const Wishlist = observer(() => {
  const [sort, setSort] = useState<'added' | 'name' | 'price' | 'discount'>('added')
  const list = [...store.wishlistGames].sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title) : sort === 'price' ? priceOf(a) - priceOf(b) : sort === 'discount' ? b.discount - a.discount : store.wishlist.indexOf(a.id) - store.wishlist.indexOf(b.id))
  const onSale = list.filter(g => g.discount > 0).length
  return (
    <div className="container">
      <div className="row-between wl-head"><div className="wl-who"><Avatar f={{ name: store.name, status: store.status }} size={64} ring={false} /><h1>{tr('wish.title', { name: store.name }).toUpperCase()}</h1></div>
        <select className="input sortsel" value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort wishlist">
          <option value="added">Sort by: date added</option><option value="name">Sort by: name</option><option value="price">Sort by: price</option><option value="discount">Sort by: discount</option>
        </select></div>
      {onSale > 0 && <div className="sale-banner">{onSale} game{onSale === 1 ? '' : 's'} from your wishlist {onSale === 1 ? 'is' : 'are'} on sale now</div>}
      {list.length === 0 && <div className="wl-empty"><b>{tr('wish.empty')}</b><p>Fill up your wishlist by browsing the store and using the "Add to your Wishlist" button.</p><Link to="/store/browse">Browse the store</Link></div>}
      {list.map(g => (
        <div className="lrow wish" key={g.id}>
          <div className="lrow-art big"><Art game={g} kind="header" /></div>
          <div className="lrow-main"><Link to={`/store/${g.id}`} className="lrow-title">{g.title}</Link><div className={`${reviewClass(g.rating, g.reviews)} small`}>{reviewLabel(g.rating, g.reviews)}</div><Tags g={g} n={3} /><div className="muted small">{g.blurb}</div></div>
          <Price game={g} />
          <div className="wish-actions">
            {store.owned.includes(g.id) ? <Link to={`/library/${g.id}`} className="btn small">In library</Link>
              : store.cart.includes(g.id) ? <Link to="/cart" className="btn green small">In cart</Link>
              : <button className="btn green small" onClick={() => store.addToCart(g.id)}>Add to cart</button>}
            <button className="link-btn small" onClick={() => store.toggleWishlist(g.id)}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  )
})
