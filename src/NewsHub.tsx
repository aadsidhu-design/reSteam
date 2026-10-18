import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES } from './data'
import { api, store } from './store'
import { Art } from './art'
import { Loading } from './ui'
import './newshub.css'

interface Item { id: number; title: string; body: string; at: number; gameId: number; gameTitle: string; author: string }

const dayLabel = (t: number) => {
  const d = new Date(t), now = new Date()
  const diff = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000)
  return diff === 0 ? 'TODAY' : diff === 1 ? 'YESTERDAY' : diff < 7 ? d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase() : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()
}

/** Store-wide news from developers, grouped by day, with a personal view for games you follow or own. */
export const NewsHub = observer(() => {
  const [scope, setScope] = useState<'all' | 'mine'>(store.signedIn ? 'mine' : 'all')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[] | null>(null)
  useEffect(() => {
    let live = true
    setItems(null)
    const t = setTimeout(() => { void api<{ news: Item[] }>('GET', `/news?scope=${scope}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`).then(r => { if (live) setItems(r?.news ?? []) }) }, 200)
    return () => { live = false; clearTimeout(t) }
  }, [scope, q])
  const groups = useMemo(() => {
    const out: [string, Item[]][] = []
    for (const it of items ?? []) { const l = dayLabel(it.at); const last = out[out.length - 1]; if (last && last[0] === l) last[1].push(it); else out.push([l, [it]]) }
    return out
  }, [items])
  return (
    <div className="nh">
      <aside className="nh-side">
        <h1>reSteam<br />NEWS HUB</h1>
        <div className="nh-h">YOUR NEWS &amp; EVENTS</div>
        <button className={`nh-item ${scope === 'mine' ? 'on' : ''}`} onClick={() => { if (store.needLogin()) return; setScope('mine') }}><b>YOUR NEWS</b><span>Personalized</span></button>
        <div className="nh-h">GLOBAL NEWS &amp; EVENTS</div>
        <button className={`nh-item ${scope === 'all' ? 'on' : ''}`} onClick={() => setScope('all')}><b>FEATURED</b><span>From every game</span></button>
        <div className="nh-h">SEARCH</div>
        <input className="nh-search" value={q} onChange={e => setQ(e.target.value)} aria-label="Search news" />
        <div className="nh-h">DISCOVER</div>
        <Link to="/store/browse" className="nh-item flat"><b>ALL GAMES</b></Link>
      </aside>
      <main className="nh-main">
        {items === null ? <Loading /> : groups.length === 0 ? (
          <p className="muted nh-empty">{scope === 'mine' ? 'Nothing yet. News from games you follow or own shows up here.' : 'No news matches.'}</p>
        ) : groups.map(([label, list]) => (
          <section key={label}>
            <h2 className="nh-day"><span>{label}</span></h2>
            {list.map(n => {
              const g = GAMES.find(x => x.id === n.gameId)
              return (
                <article key={n.id} className="nh-card">
                  <Link to={`/store/${n.gameId}`} className="nh-art">{g && <Art game={g} kind="wide" showTitle={false} />}</Link>
                  <div className="nh-body">
                    <div className="nh-src">{g && <span className="nh-ico"><Art game={g} kind="icon" /></span>}{n.gameTitle}</div>
                    <h3>{n.title}</h3>
                    <div className="nh-meta">NEWS <span>{new Date(n.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</span> · {n.author}</div>
                    <p>{n.body.length > 240 ? `${n.body.slice(0, 240)}…` : n.body}</p>
                  </div>
                </article>
              )
            })}
          </section>
        ))}
      </main>
    </div>
  )
})
