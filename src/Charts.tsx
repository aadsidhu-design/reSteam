import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact, fmt, priceOf } from './data'
import { api } from './store'
import { Art } from './art'
import { Loading } from './ui'
import { t } from './i18n'
import './charts.css'

type Row = { gameId: number; value: number | string; minutes?: number; rank: number; change: number | null; isNew: boolean; weeks: number }
type Kind = 'topselling' | 'mostplayed' | 'wishlisted' | 'new'
type Charts = Record<Kind, Row[]>
const TABS: [Kind, string, string][] = [
  ['topselling', 'Top Sellers', 'Games owned by the most players right now'],
  ['mostplayed', 'Most Played', 'Games with the most players in them right now, then by total hours'],
  ['wishlisted', 'Most Wishlisted', 'Games on the most wishlists'],
  ['new', 'New Releases', 'The newest published games'],
]

export const ChartsPage = observer(() => {
  const [data, setData] = useState<Charts | null>(null)
  const [tab, setTab] = useState<Kind>('topselling')
  useEffect(() => { void api<Charts>('GET', '/charts').then(r => setData(r ?? { topselling: [], mostplayed: [], wishlisted: [], new: [] })) }, [])
  const meta = TABS.find(x => x[0] === tab)!
  const rows = data?.[tab] ?? []
  const lead = GAMES.find(g => g.id === rows[0]?.gameId)
  return (
    <div className="charts">
      <div className="ch-subnav"><div className="ch-subnav-in">{TABS.map(([k, label]) => <button key={k} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}</div></div>
      <div className="ch-hero">
        {lead && <div className="ch-bd" aria-hidden><Art game={lead} kind="hero" showTitle={false} /></div>}
        <h1>{meta[1].toUpperCase()}</h1>
        <p>{meta[2]}.</p>
      </div>
      <div className="ch-wrap">
        <div className="ch-head"><span className="ch-c-rank">{t('ch.rank')}</span><span className="grow" />{tab !== 'new' && <span className="ch-c-val">{tab === 'topselling' ? t('ch.owners') : tab === 'mostplayed' ? t('ch.playing') : t('ch.wishlists')}</span>}<span className="ch-c-price">{t('browse.price')}</span><span className="ch-c-chg">{t('ch.change')}</span><span className="ch-c-wk">{t('ch.weeks')}</span></div>
        {data === null ? <Loading /> : (
          <div className="ch-list">
            {rows.map(r => {
              const g = GAMES.find(x => x.id === r.gameId)
              if (!g) return null
              return (
                <Link key={r.gameId} to={`/store/${g.id}`} className="ch-row">
                  <span className="ch-rank">{r.rank}</span>
                  <div className="ch-art"><Art game={g} kind="header" /></div>
                  <div className="ch-main"><b>{g.title}</b></div>
                  {tab !== 'new' && <div className="ch-val">{compact(Number(r.value))}{tab === 'mostplayed' && <div className="muted small">{compact(Math.round((r.minutes ?? 0) / 60))} hrs</div>}</div>}
                  <div className="ch-price">{g.price === 0 ? t('home.free') : fmt(priceOf(g))}</div>
                  <div className="ch-chg">{r.isNew ? <span className="up">NEW</span> : r.change === null || r.change === 0 ? <span className="muted">–</span> : r.change > 0 ? <span className="up">▲ {r.change}</span> : <span className="down">▼ {-r.change}</span>}</div>
                  <div className="ch-wk">{r.weeks}</div>
                </Link>
              )
            })}
            {rows.length === 0 && <p className="muted ch-empty">{t('ch.nothing')}</p>}
          </div>
        )}
      </div>
    </div>
  )
})
