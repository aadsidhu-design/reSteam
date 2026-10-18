import { useEffect, useState } from 'react'
import { t } from './i18n'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact } from './data'
import { api } from './store'
import { Art } from './art'
import { Loading } from './ui'
import { CapPrice } from './StorePages'
import './charts.css'

type Row = { gameId: number; value: number | string; minutes?: number }
interface Charts { topselling: Row[]; mostplayed: Row[]; wishlisted: Row[]; new: Row[] }
const TABS = [
  ['topselling', 'Top Sellers', 'Games owned by the most players'],
  ['mostplayed', 'Most Played', 'Players in a game right now, then total hours played'],
  ['wishlisted', 'Most Wishlisted', 'Games on the most wishlists'],
  ['new', 'New Releases', 'The newest published games'],
] as const

export const ChartsPage = observer(() => {
  const [data, setData] = useState<Charts | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('topselling')
  useEffect(() => { void api<Charts>('GET', '/charts').then(r => setData(r ?? { topselling: [], mostplayed: [], wishlisted: [], new: [] })) }, [])
  const meta = TABS.find(t => t[0] === tab)!
  return (
    <div className="container charts">
      <h1>{t('ch.title')}</h1>
      <div className="ch-tabs">{TABS.map(([k, label]) => <button key={k} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}</div>
      <p className="muted">{meta[2]}.</p>
      {data === null ? <Loading /> : (
        <div className="ch-list">
          {data[tab].map((r, i) => {
            const g = GAMES.find(x => x.id === r.gameId)
            if (!g) return null
            return (
              <Link key={r.gameId} to={`/store/${g.id}`} className="ch-row">
                <span className="ch-rank">{i + 1}</span>
                <div className="ch-art"><Art game={g} kind="header" /></div>
                <div className="ch-main"><b>{g.title}</b><span className="muted small">{g.genre.join(', ')}</span></div>
                <div className="ch-val">
                  {tab === 'mostplayed' ? <><b>{compact(Number(r.value))}</b> <span className="muted small">playing now</span><div className="muted small">{compact(Math.round((r.minutes ?? 0) / 60))} hrs total</div></>
                    : tab === 'new' ? <span className="muted">{new Date(String(r.value)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    : <><b>{compact(Number(r.value))}</b> <span className="muted small">{tab === 'topselling' ? 'owners' : 'wishlists'}</span></>}
                </div>
                <CapPrice g={g} />
              </Link>
            )
          })}
          {data[tab].length === 0 && <p className="muted">{t('ch.nothing')}</p>}
        </div>
      )}
    </div>
  )
})
