import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Card, CapPrice, Tags } from './StorePages'
import { t } from './i18n'
import './specials.css'

type Filter = 'all' | '50' | 'under10' | 'free'

/** Discounts & Events: big title over blurred art, a spotlight carousel and every game that is on sale. */
export const Specials = observer(() => {
  const sale = useMemo(() => GAMES.filter(g => g.discount > 0 && !store.ignored.includes(g.id)).sort((a, b) => b.discount - a.discount || b.owners - a.owners), [GAMES.length, store.ignored.length])
  const [i, setI] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [paused, setPaused] = useState(false)
  const spot = sale.slice(0, 6)
  const cur = spot[i % Math.max(1, spot.length)]
  useEffect(() => {
    if (paused || store.settings.reduceMotion || spot.length < 2) return
    const timer = setInterval(() => setI(n => (n + 1) % spot.length), 7000)
    return () => clearInterval(timer)
  }, [paused, spot.length])
  const list = sale.filter(g => filter === 'all' || (filter === '50' && g.discount >= 50) || (filter === 'under10' && g.price * (1 - g.discount / 100) <= 1000) || (filter === 'free' && g.price === 0))
  return (
    <div className="sp-page">
      <div className="sp-hero">
        {cur && <div className="sp-bd" aria-hidden><Art game={cur} kind="hero" showTitle={false} /></div>}
        <h1>{t('home.discounts').toUpperCase()}</h1>
      </div>
      {cur ? (
        <div className="sp-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <button className="sp-arrow l" onClick={() => setI((i + spot.length - 1) % spot.length)} aria-label={t('sg.prev')}><Icon name="chevronLeft" size={46} /></button>
          <div className="sp-main" key={cur.id}>
            <Link to={`/store/${cur.id}`} className="sp-media"><Art game={cur} kind="wide" showTitle={false} variant={1} /></Link>
            <div className="sp-side">
              <Link to={`/store/${cur.id}`} className="sp-cap"><Art game={cur} kind="header" /></Link>
              <button className={`sp-wish ${store.wishlist.includes(cur.id) ? 'on' : ''}`} onClick={() => store.toggleWishlist(cur.id)} aria-label={t('game.wish')}><Icon name="star" size={22} /></button>
              <Tags g={cur} n={4} />
              <div className="sp-price"><CapPrice g={cur} /></div>
            </div>
          </div>
          <button className="sp-arrow r" onClick={() => setI((i + 1) % spot.length)} aria-label={t('sg.next')}><Icon name="chevronRight" size={46} /></button>
        </div>
      ) : <p className="muted sp-empty">{t('ch.nothing')}</p>}
      <div className="container">
        <div className="sp-filters">{([['all', 'All discounts'], ['50', '50% or more'], ['under10', 'Under $10'], ['free', 'Free to play']] as [Filter, string][]).map(([k, label]) => <button key={k} className={k === filter ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>)}<span className="grow" /><span className="muted small">{list.length} {list.length === 1 ? 'game' : 'games'} on sale</span></div>
        <div className="cards">{list.map(g => <Card key={g.id} g={g} />)}</div>
        {list.length === 0 && <p className="muted sp-empty">{t('ch.nothing')}</p>}
      </div>
    </div>
  )
})
