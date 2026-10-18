import { useMemo, useState } from 'react'
import { t } from './i18n'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact, reviewLabel, type Game } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { CapPrice, Tags, reviewClass } from './StorePages'
import './explore.css'

const QUEUE_SIZE = 12
const dayKey = () => new Date().toISOString().slice(0, 10)
const KEY = 'resteam:queue:v1'

/** Builds today's queue: games you do not own and have not ignored, favouring what players actually own and review. */
const build = (): number[] =>
  GAMES.filter(g => !store.owned.includes(g.id) && !store.ignored.includes(g.id))
    .map(g => ({ id: g.id, score: g.owners * 3 + g.reviews * 2 + (g.rating || 50) / 100 + g.discount / 100 + (store.followed.includes(g.id) ? 5 : 0) }))
    .sort((a, b) => b.score - a.score || a.id - b.id).slice(0, QUEUE_SIZE).map(x => x.id)

/** Remembers which day's queue you finished, so it resets daily like the real one. */
function load(): { day: string; ids: number[]; at: number } {
  try {
    const s = JSON.parse(localStorage.getItem(`${KEY}:${store.user?.username}`) ?? 'null')
    if (s?.day === dayKey()) return s
  } catch { /* ignore */ }
  return { day: dayKey(), ids: build(), at: 0 }
}
const save = (s: { day: string; ids: number[]; at: number }) => { try { localStorage.setItem(`${KEY}:${store.user?.username}`, JSON.stringify(s)) } catch { /* ignore */ } }

export const Explore = observer(() => {
  const [q, setQ] = useState(load)
  const items = useMemo(() => q.ids.map(id => GAMES.find(g => g.id === id)).filter((g): g is Game => !!g), [q.ids])
  const done = q.at >= items.length
  const g = items[q.at]
  const next = () => { const n = { ...q, at: q.at + 1 }; save(n); setQ(n) }
  const restart = () => { const n = { day: dayKey(), ids: build(), at: 0 }; save(n); setQ(n) }

  if (done) {
    return (
      <div className="container dq-page">
        <h1>{t('dq.done')}</h1>
        <p className="muted">You have looked at all {items.length} recommendations for today. A fresh queue appears tomorrow, or you can look at more now.</p>
        <div className="dq-done"><button className="btn blue" onClick={restart}>{t('dq.another')}</button><Link to="/store" className="btn">{t('dq.back')}</Link></div>
      </div>
    )
  }
  return (
    <div className="container dq-page">
      <div className="dq-head"><h1>{t('mm.queue')}</h1><div className="muted">{q.at + 1} of {items.length}</div></div>
      <div className="dq-bar"><span style={{ width: `${(q.at / items.length) * 100}%` }} /></div>
      <div className="dq-card">
        <Link to={`/store/${g.id}`} className="dq-art"><Art game={g} kind="wide" /></Link>
        <div className="dq-side">
          <Link to={`/store/${g.id}`} className="dq-title">{g.title}</Link>
          <div><span className={reviewClass(g.rating, g.reviews)}>{reviewLabel(g.rating, g.reviews)}</span>{g.reviews >= 10 && <span className="muted"> ({compact(g.reviews)})</span>}</div>
          <div className="fp-shots">{[1, 2, 3, 4].map(n => <div key={n} className="fp-shot"><Art game={g} kind="shot" variant={n} showTitle={false} /></div>)}</div>
          <p className="muted small">{g.blurb}</p>
          <Tags g={g} n={4} />
          <div className="dq-price"><CapPrice g={g} /></div>
        </div>
      </div>
      <div className="dq-actions">
        <button className="btn bright" onClick={() => { store.toggleWishlist(g.id); }}><Icon name="star" size={16} /> {store.wishlist.includes(g.id) ? 'On your wishlist' : 'Add to your wishlist'}</button>
        <button className="btn" onClick={() => { if (!store.signedIn) return; store.toggleIgnore(g.id); next() }}>{t('dq.notint')}</button>
        <span className="grow" />
        <button className="btn blue big" onClick={next}>{t('dq.next')} <Icon name="chevronRight" size={18} /></button>
      </div>
    </div>
  )
})
