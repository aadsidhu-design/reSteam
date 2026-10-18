import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, fmt, priceOf, type Game } from './data'
import { store } from './store'
import { Art } from './art'
import { Card } from './StorePages'
import { t } from './i18n'
import './newreleases.css'

const Spot = ({ g }: { g: Game }) => (
  <Link to={`/store/${g.id}`} className="nr-spot">
    <div className="nr-spot-art"><Art game={g} kind="wide" />{g.playing > 0 && <span className="nr-live"><i /> LIVE</span>}</div>
    <div className="nr-spot-cap"><div className="nr-spot-t">{g.owners > 0 ? 'Popular this month' : 'Just released'}</div><div className="small">{g.price === 0 ? t('home.free') : fmt(priceOf(g))}</div></div>
  </Link>
)

/** New Releases: breadcrumb, big title, two spotlight capsules and the newest games, as on the real page. */
export const NewReleases = observer(() => {
  const list = useMemo(() => GAMES.filter(g => !store.ignored.includes(g.id) && g.released).sort((a, b) => b.released.localeCompare(a.released) || b.owners - a.owners), [GAMES.length, store.ignored.length])
  const spots = useMemo(() => [...list.slice(0, 12)].sort((a, b) => b.owners + b.playing * 5 - (a.owners + a.playing * 5)).slice(0, 2), [list])
  return (
    <div className="nr-page">
      <div className="nr-head">
        <div className="container">
          <div className="nr-crumbs"><Link to="/store/browse">All Products</Link> &gt; <span>{t('mm.newreleases')}</span></div>
          <h1>{t('mm.newreleases')}</h1>
        </div>
      </div>
      <div className="container">
        <div className="nr-spots">{spots.map(g => <Spot key={g.id} g={g} />)}</div>
        <h2 className="nr-h2">{t('nr.newest')}</h2>
        <div className="cards">{list.slice(0, 12).map(g => <Card key={g.id} g={g} />)}</div>
        <p className="muted nr-more"><Link to="/store/browse?sort=new">{t('nr.seeall')}</Link></p>
      </div>
    </div>
  )
})
