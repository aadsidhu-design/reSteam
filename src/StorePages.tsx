import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { ALL_TAGS, GAMES, GENRES, compact, fmt, priceOf, reviewLabel, type Game } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Modal, Price, useDismiss } from './ui'
import './store.css'

export const reviewClass = (rating: number) => (rating >= 70 ? 'rv-pos' : rating >= 40 ? 'rv-mixed' : 'rv-neg')

/* ---------- layout with the store sub-menu ---------- */
type MenuItem = { label: string; to: string }
const MENUS: Record<string, MenuItem[]> = {
  Browse: [
    { label: 'Featured', to: '/store' }, { label: 'New & Trending', to: '/store/browse?sort=new' }, { label: 'Top Sellers', to: '/store/browse?sort=top' },
    { label: 'Specials', to: '/store/browse?sale=1' }, { label: 'Free to Play', to: '/store/browse?free=1' },
  ],
  Recommendations: [
    { label: 'Your Wishlist', to: '/wishlist' }, { label: 'Played by your friends', to: '/store/browse?friends=1' }, { label: 'Highly rated (95%+)', to: '/store/browse?minRating=95' },
  ],
  Categories: GENRES.map(g => ({ label: g, to: `/store/browse?genre=${encodeURIComponent(g)}` })),
  Hardware: [
    { label: 'Light installs (under 5 GB)', to: '/store/browse?maxSize=5' }, { label: 'Big installs (over 40 GB)', to: '/store/browse?minSize=40' },
  ],
  'Ways to Play': ['Singleplayer', 'Multiplayer', 'Co-op', 'Local Multiplayer'].map(t => ({ label: t, to: `/store/browse?tag=${encodeURIComponent(t)}` })),
  'Special Sections': [
    { label: 'Under $10', to: '/store/browse?under=1000' }, { label: 'Cozy games', to: '/store/browse?tag=Cozy' }, { label: 'Deckbuilders', to: '/store/browse?tag=Deckbuilding' },
    { label: 'Roguelikes', to: '/store/browse?tag=Roguelike' }, { label: 'Horror', to: '/store/browse?genre=Horror' },
  ],
}

const SearchBox = () => {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const hits = q.trim() ? GAMES.filter(g => g.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : []
  return (
    <div className="ssearch popwrap" ref={ref}>
      <form className="ssearch-form" onSubmit={e => { e.preventDefault(); setOpen(false); nav(`/store/browse?q=${encodeURIComponent(q.trim())}`) }}>
      <input placeholder="Search the store" value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} aria-label="Search the store" />
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
}

const NavMenu = ({ label, items }: { label: string; items: MenuItem[] }) => {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const nav = useNavigate()
  return (
    <div className="smenu popwrap" ref={ref} onMouseLeave={() => setOpen(false)}>
      <button className={open ? 'on' : ''} onMouseEnter={() => setOpen(true)} onClick={() => setOpen(!open)}>{label} <Icon name="chevronDown" size={16} /></button>
      {open && (
        <div className={`popover smenu-pop ${items.length > 8 ? 'cols' : ''}`} style={{ left: 0, top: '100%' }}>
          {items.map(i => <button key={i.label} className="pop-item" onClick={() => { setOpen(false); nav(i.to) }}>{i.label}</button>)}
        </div>
      )}
    </div>
  )
}

export const StoreLayout = observer(() => (
  <div className="store">
    <div className="subnav">
      <div className="subnav-in">
        {Object.entries(MENUS).map(([label, items]) => <NavMenu key={label} label={label} items={items} />)}
        <div className="grow" />
        <SearchBox />
        <NavLink to="/wishlist" className="wishlink"><Icon name="star" size={18} /> Wishlist <span className="muted small">{store.wishlist.length}</span></NavLink>
        <NavLink to="/cart" className="wishlink"><Icon name="cart" size={20} /> {store.cart.length > 0 && <span className="cart-count">{store.cart.length}</span>}</NavLink>
      </div>
    </div>
    <div className="store-page"><Outlet /></div>
  </div>
))

/* ---------- small shared pieces ---------- */
export const Tags = ({ g, n = 4 }: { g: Game; n?: number }) => (
  <div className="tagrow">{g.tags.slice(0, n).map(t => <Link key={t} to={`/store/browse?tag=${encodeURIComponent(t)}`} className="tagchip">{t}</Link>)}</div>
)

const ListRow = ({ g }: { g: Game }) => (
  <Link to={`/store/${g.id}`} className="lrow">
    <div className="lrow-art"><Art game={g} kind="header" /></div>
    <div className="lrow-main">
      <div className="lrow-title">{g.title}</div>
      <Tags g={g} n={3} />
    </div>
    <div className="lrow-rate"><span className={reviewClass(g.rating)}>{reviewLabel(g.rating)}</span></div>
    <Price game={g} />
  </Link>
)

const Card = ({ g }: { g: Game }) => (
  <Link to={`/store/${g.id}`} className="scard">
    <div className="scard-art"><Art game={g} kind="header" /></div>
    <div className="scard-body"><div className="scard-title">{g.title}</div><Tags g={g} n={2} /><Price game={g} /></div>
  </Link>
)

/* ---------- gift card modal ---------- */
const GiftModal = observer(({ onClose }: { onClose: () => void }) => {
  const pals = store.friends.filter(f => f.status !== 'pending')
  const [friend, setFriend] = useState(pals[0]?.id ?? '')
  const [amount, setAmount] = useState(1000)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal title="Send a Gift Card" onClose={onClose}>
      <p>Send wallet funds to a friend. The amount comes out of your balance ({fmt(store.wallet)}).</p>
      <label className="small muted">Friend</label>
      <select className="input" value={friend} onChange={e => setFriend(e.target.value)}>{pals.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      <div className="amounts">{[500, 1000, 2500, 5000, 10000].map(a => <button key={a} className={`btn ${amount === a ? 'blue' : ''}`} onClick={() => setAmount(a)}>{fmt(a)}</button>)}</div>
      {err && <div className="err">{err}</div>}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn green" disabled={!friend || busy} onClick={async () => {
          setBusy(true); const e = await store.gift(friend, amount); setBusy(false)
          if (e) setErr(e); else { store.toast(`Gift card sent to ${pals.find(f => f.id === friend)?.name}`); onClose() }
        }}>Send gift card</button>
      </div>
    </Modal>
  )
})

/* ---------- store home ---------- */
export const StoreHome = observer(() => {
  const nav = useNavigate()
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [gift, setGift] = useState(false)
  const [tab, setTab] = useState<'new' | 'top' | 'sale'>('top')
  const featured = useMemo(() => [...GAMES].sort((a, b) => b.reviews * b.rating - a.reviews * a.rating).slice(0, 7), [])
  const sale = useMemo(() => [...GAMES].filter(g => g.discount > 0).sort((a, b) => b.discount - a.discount), [])
  const hero = sale.slice(0, 3)
  const f = featured[idx]
  const maxOff = Math.max(...GAMES.map(g => g.discount))
  const tabList = tab === 'new' ? [...GAMES].sort((a, b) => b.released.localeCompare(a.released)) : tab === 'top' ? [...GAMES].sort((a, b) => b.reviews - a.reviews) : sale
  const free = GAMES.filter(g => g.price === 0)

  useEffect(() => {
    if (paused || store.settings.reduceMotion) return
    const t = setInterval(() => setIdx(i => (i + 1) % featured.length), 6000)
    return () => clearInterval(t)
  }, [paused, featured.length])

  return (
    <div className="shome">
      <section className="hero-banner" style={{ ['--h' as string]: hero[0].hue }}>
        <div className="hb-left"><Art game={hero[0]} kind="hero" showTitle={false} variant={1} /></div>
        <div className="hb-body">
          <div className="hb-head"><div className="hb-mark">reSteam</div><div className="hb-sep" /><div className="hb-title">WEEKEND SALE</div></div>
          <div className="hb-sub">Save up to {maxOff}% on {sale.length} games</div>
          <div className="hb-caps">
            {hero.map((g, i) => (
              <Link key={g.id} to={`/store/${g.id}`} className={`hb-cap c${i}`}>
                <Art game={g} kind="wide" />
                <span className="hb-badge">-{g.discount}%</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container">
        <div className="sec-head2">
          <h2>Featured &amp; Recommended</h2>
          <button className="giftbtn" onClick={() => setGift(true)}><span className="giftart"><Icon name="gift" size={26} /></span> Send a Gift Card</button>
        </div>
        <div className="feat" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <button className="feat-arrow l" onClick={() => setIdx((idx + featured.length - 1) % featured.length)} aria-label="Previous"><Icon name="chevronLeft" size={34} /></button>
          <Link to={`/store/${f.id}`} className="feat-main"><Art game={f} kind="wide" variant={idx % 3} /></Link>
          <div className="feat-panel">
            <div className="fp-title">{f.title}</div>
            <div className="fp-rev"><span className={reviewClass(f.rating)}>{reviewLabel(f.rating)}</span> <span className="muted">({compact(f.reviews)} Reviews)</span></div>
            <div className="fp-shots">{[1, 2, 3, 4].map(n => <div key={n} className="fp-shot"><Art game={f} kind="shot" variant={n} showTitle={false} /></div>)}</div>
            <Tags g={f} n={4} />
            <div className="fp-foot">
              {f.price === 0 ? <span className="fp-free">Free to Play</span> : <Price game={f} />}
              <button className="btn green small" onClick={() => nav(`/store/${f.id}`)}>View</button>
            </div>
          </div>
          <button className="feat-arrow r" onClick={() => setIdx((idx + 1) % featured.length)} aria-label="Next"><Icon name="chevronRight" size={34} /></button>
        </div>
        <div className="dots">{featured.map((_, i) => <button key={i} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`} />)}</div>
      </section>

      <section className="container">
        <div className="sec-head2"><h2>Special Offers</h2><Link to="/store/browse?sale=1" className="more">Browse more</Link></div>
        <div className="cards">{sale.slice(0, 4).map(g => <Card key={g.id} g={g} />)}</div>
      </section>

      <section className="container two">
        <div>
          <div className="tabs3">
            {([['new', 'New & Trending'], ['top', 'Top Sellers'], ['sale', 'Specials']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          <div className="list">{tabList.slice(0, 8).map(g => <ListRow key={g.id} g={g} />)}</div>
        </div>
        <aside>
          <h2>Browse by tag</h2>
          <div className="tagcloud">{ALL_TAGS.slice(0, 24).map(t => <Link key={t} to={`/store/browse?tag=${encodeURIComponent(t)}`} className="tagchip">{t}</Link>)}</div>
          {store.viewed.length > 0 && (
            <>
              <h2 className="mt">Recently viewed</h2>
              <div className="recent-v">{store.viewed.slice(0, 5).map(id => { const g = GAMES.find(x => x.id === id)!; return <Link key={id} to={`/store/${id}`}>{g.title}</Link> })}</div>
            </>
          )}
        </aside>
      </section>

      <section className="container">
        <div className="sec-head2"><h2>Free to Play</h2><Link to="/store/browse?free=1" className="more">Browse more</Link></div>
        <div className="cards">{free.map(g => <Card key={g.id} g={g} />)}</div>
      </section>

      <section className="container">
        <h2>Browse by genre</h2>
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

/* ---------- browse / search results ---------- */
export const Browse = observer(() => {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const genre = sp.get('genre'), tag = sp.get('tag'), sort = sp.get('sort') ?? 'relevance'
  const free = sp.get('free') === '1', sale = sp.get('sale') === '1', friends = sp.get('friends') === '1'
  const maxSize = Number(sp.get('maxSize') ?? 0), minSize = Number(sp.get('minSize') ?? 0), under = Number(sp.get('under') ?? 0), minRating = Number(sp.get('minRating') ?? 0)
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v === null || v === '') n.delete(k); else n.set(k, v); setSp(n) }

  let list = GAMES.filter(g =>
    (!q || g.title.toLowerCase().includes(q.toLowerCase()) || g.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))) &&
    (!genre || g.genre.includes(genre)) && (!tag || g.tags.includes(tag)) && (!free || g.price === 0) && (!sale || g.discount > 0) &&
    (!maxSize || g.sizeGb <= maxSize) && (!minSize || g.sizeGb >= minSize) && (!under || priceOf(g) <= under) && (!minRating || g.rating >= minRating) &&
    (!friends || store.friends.some(f => f.gameId === g.id)))
  list = [...list].sort((a, b) => sort === 'new' ? b.released.localeCompare(a.released) : sort === 'top' ? b.reviews - a.reviews : sort === 'price' ? priceOf(a) - priceOf(b) : sort === 'rating' ? b.rating - a.rating : b.reviews * b.rating - a.reviews * a.rating)
  const chips: [string, string][] = [['q', q && `Search: ${q}`], ['genre', genre ?? ''], ['tag', tag ?? ''], ['free', free ? 'Free to Play' : ''], ['sale', sale ? 'On sale' : ''],
    ['friends', friends ? 'Played by friends' : ''], ['maxSize', maxSize ? `Under ${maxSize} GB` : ''], ['minSize', minSize ? `Over ${minSize} GB` : ''], ['under', under ? `Under ${fmt(under)}` : ''], ['minRating', minRating ? `${minRating}%+ positive` : '']]
  const active = chips.filter(([, v]) => v)

  return (
    <div className="container browse">
      <div>
        <h1>{list.length} result{list.length === 1 ? '' : 's'} match your search.</h1>
        {list.length === 0 && <p className="muted">Try removing a filter. <Link to="/store">Back to featured</Link></p>}
        <div className="list">{list.map(g => <ListRow key={g.id} g={g} />)}</div>
      </div>
      <aside className="filters">
        <h2>Sort by</h2>
        <select className="input" value={sort} onChange={e => set('sort', e.target.value)}>
          <option value="relevance">Relevance</option><option value="new">Release date</option><option value="top">Most reviews</option><option value="rating">User reviews</option><option value="price">Price</option>
        </select>
        {active.length > 0 && (<><h2 className="mt">Active filters</h2><div className="tagcloud">{active.map(([k, v]) => <button key={k} className="tagchip x" onClick={() => set(k, null)}>{v} ✕</button>)}</div></>)}
        <h2 className="mt">Narrow by genre</h2>
        <div className="checks">{GENRES.map(g => <label key={g}><input type="checkbox" checked={genre === g} onChange={() => set('genre', genre === g ? null : g)} /> {g}</label>)}</div>
        <h2 className="mt">Narrow by tag</h2>
        <div className="tagcloud">{ALL_TAGS.slice(0, 16).map(t => <button key={t} className={`tagchip ${tag === t ? 'sel' : ''}`} onClick={() => set('tag', tag === t ? null : t)}>{t}</button>)}</div>
        <h2 className="mt">Narrow by price</h2>
        <input type="range" min={0} max={6000} step={500} value={under || 6000} onChange={e => set('under', Number(e.target.value) >= 6000 ? null : e.target.value)} />
        <div className="small muted">{under ? `Under ${fmt(under)}` : 'Any price'}</div>
      </aside>
    </div>
  )
})

/* ---------- cart ---------- */
export const Cart = observer(() => {
  const nav = useNavigate()
  const [err, setErr] = useState('')
  const [done, setDone] = useState<number[] | null>(null)
  if (done) {
    const gs = GAMES.filter(g => done.includes(g.id))
    return (
      <div className="container">
        <h1>Thank you for your purchase!</h1>
        <p className="muted">Your new games are in your library.</p>
        {gs.map(g => <div key={g.id} className="lrow"><div className="lrow-art"><Art game={g} kind="header" /></div><div className="lrow-main"><div className="lrow-title">{g.title}</div></div>
          <button className="btn blue" onClick={() => { store.install(g.id); nav('/downloads') }}>Install</button></div>)}
        <p><Link to="/library" className="btn green">Go to my library</Link></p>
      </div>
    )
  }
  const short = store.cartTotal > store.wallet
  return (
    <div className="container cart">
      <h1>Your Shopping Cart</h1>
      {store.cartGames.length === 0 ? <p className="muted">Your cart is empty. <Link to="/store">Continue shopping</Link></p> : (
        <div className="cart-grid">
          <div>
            {store.cartGames.map(g => (
              <div className="lrow" key={g.id}>
                <div className="lrow-art"><Art game={g} kind="header" /></div>
                <div className="lrow-main"><Link to={`/store/${g.id}`} className="lrow-title">{g.title}</Link><div className="muted small">{g.sizeGb.toFixed(1)} GB</div></div>
                <Price game={g} />
                <button className="link-btn" onClick={() => store.removeFromCart(g.id)}>Remove</button>
              </div>
            ))}
          </div>
          <aside className="summary">
            <div className="row-between"><span>Estimated total</span><b>{fmt(store.cartTotal)}</b></div>
            <div className="row-between muted small"><span>Wallet balance</span><span>{fmt(store.wallet)}</span></div>
            {short && <div className="err small">You need {fmt(store.cartTotal - store.wallet)} more in your wallet.</div>}
            {err && <div className="err">{err}</div>}
            <button className="btn green big-btn" disabled={short} onClick={() => { const ids = store.cart.slice(); if (store.checkout()) setDone(ids); else setErr('Not enough funds in your wallet.') }}>Purchase for myself</button>
            <button className="btn" onClick={() => store.addFunds(2000)}>Add {fmt(2000)} to wallet</button>
          </aside>
        </div>
      )}
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
      <div className="row-between"><h1>Your Wishlist</h1>
        <select className="input sortsel" value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort wishlist">
          <option value="added">Sort by: date added</option><option value="name">Sort by: name</option><option value="price">Sort by: price</option><option value="discount">Sort by: discount</option>
        </select></div>
      {onSale > 0 && <div className="sale-banner">{onSale} game{onSale === 1 ? '' : 's'} from your wishlist {onSale === 1 ? 'is' : 'are'} on sale now</div>}
      {list.length === 0 && <p className="muted">Your wishlist is empty. <Link to="/store">Browse the store</Link></p>}
      {list.map(g => (
        <div className="lrow wish" key={g.id}>
          <div className="lrow-art big"><Art game={g} kind="header" /></div>
          <div className="lrow-main"><Link to={`/store/${g.id}`} className="lrow-title">{g.title}</Link><div className={`${reviewClass(g.rating)} small`}>{reviewLabel(g.rating)}</div><Tags g={g} n={3} /><div className="muted small">{g.blurb}</div></div>
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
