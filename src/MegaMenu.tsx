import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { ALL_TAGS, GAMES, GENRES, fmt, priceOf, type Game } from './data'
import { store } from './store'
import { t } from './i18n'
import { Art } from './art'
import { Icon } from './icons'
import './mega.css'

type Menu = 'Browse' | 'Recommendations' | 'Categories' | 'Hardware' | 'Ways to Play' | 'Special Sections'
const MENUS: Menu[] = ['Browse', 'Recommendations', 'Categories', 'Hardware', 'Ways to Play', 'Special Sections']
const LABEL: Record<Menu, string> = { Browse: 'menu.browse', Recommendations: 'menu.reco', Categories: 'menu.cats', Hardware: 'menu.hw', 'Ways to Play': 'menu.ways', 'Special Sections': 'menu.special' }

const enc = encodeURIComponent
const topOf = (pred: (g: Game) => boolean): Game | undefined =>
  [...GAMES].filter(pred).sort((a, b) => b.owners - a.owners || b.reviews - a.reviews || b.discount - a.discount)[0]

const Tile = ({ to, label, game, onGo }: { to: string; label: string; game?: Game; onGo: () => void }) => (
  <Link to={to} className="mg-tile" onClick={onGo}>
    {game && <Art game={game} kind="header" showTitle={false} />}
    <span className="mg-tile-label">{label}</span>
  </Link>
)

const Blue = ({ to, label, icon, onGo }: { to: string; label: string; icon: Parameters<typeof Icon>[0]['name']; onGo: () => void }) => (
  <Link to={to} className="mg-blue" onClick={onGo}><Icon name={icon} size={30} /><span>{label}</span></Link>
)

const Browse = ({ go }: { go: () => void }) => {
  const hero = topOf(g => g.discount > 0) ?? GAMES[0]
  const rows: [string, string, string?][] = [
    ['Store Home', '/store'],
    ['New Releases', '/store/browse?sort=new', 'Explore new content on reSteam'],
    ['All Charts & Stats', '/charts', 'See what players own, play and wishlist'],
    ['Top Sellers', '/store/browse?sort=top', 'The games players own and review most'],
    ['Discounts & Events', '/store/browse?sale=1'],
    ['Free to Play', '/store/browse?free=1'],
    ['Browser Games', '/store/browse?playable=1', 'Play instantly, nothing to install'],
    ['Upload a Game', '/developer', 'Publish your own game'],
  ]
  return (
    <div className="mg-browse">
      <div className="mg-list">
        {rows.map(([t, to, sub]) => <Link key={t} to={to} onClick={go} className="mg-row"><b>{t}</b>{sub && <span>{sub}</span>}</Link>)}
      </div>
      <Link to="/store/browse?sort=top" onClick={go} className="mg-hero"><Art game={hero} kind="wide" showTitle={false} /><span className="mg-hero-btn">TOP SELLERS</span></Link>
      <div className="mg-list narrow">
        <Link to="/store/browse" onClick={go} className="mg-link">Advanced Search</Link>
        <Link to="/wishlist" onClick={go} className="mg-link">My Wishlist</Link>
        <Link to="/settings/account" onClick={go} className="mg-link">My Account</Link>
        <Link to="/community" onClick={go} className="mg-link">Community</Link>
      </div>
    </div>
  )
}

const Recommendations = observer(({ go }: { go: () => void }) => {
  const picks = useMemo(() => GAMES.filter(g => !store.owned.includes(g.id) && !store.ignored.includes(g.id))
    .sort((a, b) => b.owners * 3 + b.reviews - (a.owners * 3 + a.reviews) || b.discount - a.discount).slice(0, 3), [store.owned.length, store.ignored.length, GAMES.length])
  return (
    <div className="mg-reco">
      <div>
        <h4 className="mg-h">RECOMMENDED FOR YOU</h4>
        {picks.map(g => (
          <Link key={g.id} to={`/store/${g.id}`} onClick={go} className="mg-pick"><div className="mg-pick-art"><Art game={g} kind="header" /></div><div><b>{g.title}</b><span>{fmt(priceOf(g))}</span></div></Link>
        ))}
      </div>
      <div className="mg-promo">
        <span className="mg-new">NEW</span>
        <Icon name="clock" size={34} />
        <div><b>Your Discovery Queue</b><p>Look through a fresh list of games picked from what players own, review and follow.</p>
          <Link to={store.signedIn ? '/explore' : '/login?next=/explore'} onClick={go} className="btn bright big mg-cta">Explore My Queue <Icon name="chevronRight" size={18} /></Link></div>
      </div>
      <div className="mg-list narrow right">
        <Link to="/explore" onClick={go} className="mg-link">Your Discovery Queue</Link>
        <Link to="/community" onClick={go} className="mg-link">Community Recommendations</Link>
        <Link to="/store/browse?sort=new" onClick={go} className="mg-link">New Releases Queue</Link>
        <Link to={store.signedIn ? '/store/browse?friends=1' : '/login?next=/store'} onClick={go} className="mg-link">Popular Among Friends</Link>
        <Link to={store.signedIn ? '/store/browse?followed=1' : '/login?next=/store'} onClick={go} className="mg-link">Games You Follow</Link>
        <Link to="/store/browse?sort=rating" onClick={go} className="mg-link">Highest Rated</Link>
      </div>
    </div>
  )
})

const Categories = ({ go }: { go: () => void }) => {
  const [expand, setExpand] = useState(false)
  const topGenres = useMemo(() => [...GENRES].sort((a, b) => GAMES.filter(g => g.genre.includes(b)).length - GAMES.filter(g => g.genre.includes(a)).length).slice(0, 6), [GAMES.length])
  const topTags = useMemo(() => [...ALL_TAGS].sort((a, b) => GAMES.filter(g => g.tags.includes(b)).length - GAMES.filter(g => g.tags.includes(a)).length).slice(0, 10), [GAMES.length])
  const cols = useMemo(() => {
    const per = Math.ceil(GENRES.length / 7)
    return Array.from({ length: 7 }, (_, i) => GENRES.slice(i * per, (i + 1) * per)).filter(c => c.length)
  }, [GENRES.length])
  return (
    <div className="mg-cats">
      <h4 className="mg-h">POPULAR CATEGORIES</h4>
      <div className="mg-tiles">{topGenres.map(g => <Tile key={g} to={`/store/browse?genre=${enc(g)}`} label={g.toUpperCase()} game={topOf(x => x.genre.includes(g))} onGo={go} />)}</div>
      <div className="mg-pills">
        {topTags.map(t => <Link key={t} to={`/store/browse?tag=${enc(t)}`} onClick={go} className="mg-pill">{t}</Link>)}
        <Link to="/store/browse" onClick={go} className="mg-all">View all tags <Icon name="chevronRight" size={14} /></Link>
      </div>
      <div className="mg-gh"><h4 className="mg-h">ALL GENRES &amp; THEMES</h4><button className="mg-expand" onClick={() => setExpand(!expand)}>{expand ? 'Collapse' : 'Expand'} <Icon name="chevronDown" size={16} /></button></div>
      <div className={`mg-cols ${expand ? 'open' : ''}`}>
        {cols.map((c, i) => <div key={i}>{c.map(g => <Link key={g} to={`/store/browse?genre=${enc(g)}`} onClick={go}>{g}</Link>)}</div>)}
        {expand && <div className="mg-tagcloud">{ALL_TAGS.map(t => <Link key={t} to={`/store/browse?tag=${enc(t)}`} onClick={go}>{t}</Link>)}</div>}
      </div>
    </div>
  )
}

const Hardware = ({ go }: { go: () => void }) => (
  <div className="mg-hw">
    <h4 className="mg-h">INSTALL SIZE</h4>
    <div className="mg-tiles three">
      <Tile to="/store/browse?maxSize=5" label="LIGHT (UNDER 5 GB)" game={topOf(g => g.sizeGb <= 5)} onGo={go} />
      <Tile to="/store/browse?minSize=40" label="BIG (OVER 40 GB)" game={topOf(g => g.sizeGb >= 40)} onGo={go} />
      <Tile to="/store/browse?playable=1" label="PLAY IN THE BROWSER" game={topOf(g => !!g.playable) ?? GAMES[0]} onGo={go} />
    </div>
    <div className="mg-links3"><Link to="/store/browse?maxSize=5" onClick={go}>Quick installs</Link><Link to="/store/browse?minSize=40" onClick={go}>Big installs</Link><Link to="/settings/storage" onClick={go}>Manage storage</Link></div>
  </div>
)

const Ways = ({ go }: { go: () => void }) => (
  <div className="mg-ways">
    <h4 className="mg-h">WAYS TO PLAY GAMES</h4>
    <div className="mg-bluerow">
      <Blue to="/store/browse?playable=1" label="PLAY IN BROWSER" icon="monitor" onGo={go} />
      <Blue to="/store/browse?download=1" label="DOWNLOADABLE" icon="download" onGo={go} />
      <Blue to="/store/browse?tag=Co-op" label="CO-OPERATIVE" icon="group" onGo={go} />
    </div>
    <div className="mg-links3">
      {['Singleplayer', 'Multiplayer', 'Co-op', 'Local Multiplayer'].map(t => <Link key={t} to={`/store/browse?tag=${enc(t)}`} onClick={go}>{t}</Link>)}
    </div>
  </div>
)

const Special = ({ go }: { go: () => void }) => (
  <div className="mg-special">
    <h4 className="mg-h">SPECIAL SECTIONS</h4>
    <div className="mg-bluerow">
      <Blue to="/store/browse?free=1" label="FREE TO PLAY" icon="gift" onGo={go} />
      <Blue to="/store/browse?under=1000" label="UNDER $10" icon="card" onGo={go} />
      <Blue to="/store/browse?user=1" label="PLAYER UPLOADS" icon="person" onGo={go} />
    </div>
    <div className="mg-list narrow right">
      <Link to="/store/browse?sale=1" onClick={go} className="mg-link">Discounts &amp; Events</Link>
      <Link to="/store/browse?minRating=95" onClick={go} className="mg-link">Highly Rated (95%+)</Link>
      <Link to="/community" onClick={go} className="mg-link">Community Hubs</Link>
      <Link to="/developer" onClick={go} className="mg-link">Publish a Game</Link>
    </div>
  </div>
)

/** The store's sub-navigation with its full-width mega menus. */
export const MegaNav = observer(({ children }: { children?: React.ReactNode }) => {
  const [open, setOpen] = useState<Menu | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  void nav
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  const go = () => setOpen(null)
  return (
    <div className="subnav" ref={ref}>
      <div className="subnav-in">
        {MENUS.map(m => (
          <button key={m} className={`mg-tab ${open === m ? 'on' : ''}`} aria-expanded={open === m} onClick={() => setOpen(open === m ? null : m)} onMouseEnter={() => { if (open) setOpen(m) }}>
            <span>{t(LABEL[m])}</span><Icon name="chevronDown" size={14} />
          </button>
        ))}
        {children}
      </div>
      {open && (
        <div className="mega" role="menu" onMouseLeave={() => setOpen(null)}>
          <div className="mega-in">
            {open === 'Browse' && <Browse go={go} />}
            {open === 'Recommendations' && <Recommendations go={go} />}
            {open === 'Categories' && <Categories go={go} />}
            {open === 'Hardware' && <Hardware go={go} />}
            {open === 'Ways to Play' && <Ways go={go} />}
            {open === 'Special Sections' && <Special go={go} />}
          </div>
        </div>
      )}
    </div>
  )
})
