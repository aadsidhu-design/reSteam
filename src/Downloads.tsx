import { Link, useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import './downloads.css'

const rate = (mb: number) => (mb <= 0 ? '0 bps' : `${mb.toFixed(1)} MB/s`)
const gameOf = (id: number) => GAMES.find(g => g.id === id)!

const eta = (progress: number, speed: number, sizeMb: number) => {
  if (speed <= 0) return 'Estimating…'
  const s = Math.max(1, Math.ceil((sizeMb * (1 - progress / 100)) / speed))
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s remaining` : `${s}s remaining`
}

const Graph = observer(() => {
  const h = store.speedHistory
  const max = Math.max(store.peakSpeed, 1)
  const pts = h.map((v, i) => `${(i / 59) * 100},${100 - (v / max) * 92}`)
  return (
    <svg className="dl-graph" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id="dlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f7fe0" stopOpacity=".75" /><stop offset="1" stopColor="#2f7fe0" stopOpacity="0.05" /></linearGradient></defs>
      {h.length > 1 && <polygon points={`0,100 ${pts.join(' ')} ${((h.length - 1) / 59) * 100},100`} fill="url(#dlg)" />}
      {h.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke="#5aa8ff" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />}
    </svg>
  )
})

export const Downloads = observer(() => {
  const nav = useNavigate()
  const active = store.activeDownload
  const waiting = store.queue.filter(d => d !== active)
  const cur = active ? gameOf(active.id) : undefined
  const speed = active?.speed ?? 0

  return (
    <div className="dl-page">
      <div className="dl-banner">
        {cur && <div className="dl-banner-art"><Art game={cur} kind="hero" showTitle={false} /></div>}
        <Graph />
        <div className="dl-stats">
          <div className="dl-stat"><span className="dl-ico blue"><Icon name="download" size={14} /></span><div><div className="caps">Network</div><b>{rate(speed)}</b></div></div>
          <div className="dl-stat"><span className="dl-ico blue"><Icon name="download" size={14} /></span><div><div className="caps">Peak</div><b>{rate(store.peakSpeed)}</b></div></div>
          <div className="dl-stat"><span className="dl-ico green">▬</span><div><div className="caps">Disk usage</div><b>{speed > 0 ? `${(speed * 0.9).toFixed(1)} MB/s` : '0 bps'}</b></div></div>
        </div>
        <button className="sq-btn dl-gear" onClick={() => nav('/settings/downloads')} aria-label="Download settings"><Icon name="gear" size={20} /></button>
      </div>

      <div className="dl-body">
        {active && cur && (
          <section className="dl-now">
            <div className="dl-now-art"><Art game={cur} kind="header" /></div>
            <div className="grow">
              <div className="dl-title">{cur.title}</div>
              <div className="muted">{active.phase} · {Math.floor(active.progress)}% Complete</div>
              <div className="dl-bar"><span style={{ width: `${active.progress}%` }} /></div>
              <div className="muted small">{((cur.sizeGb * active.progress) / 100).toFixed(2)} GB of {cur.sizeGb.toFixed(2)} GB · {eta(active.progress, active.speed, cur.sizeGb * 1024)}</div>
            </div>
            <button className="btn" onClick={() => store.pause(active.id)}><Icon name="pause" size={18} /> Pause</button>
          </section>
        )}

        <section>
          <div className="dl-head"><h3>Up Next <span className="muted">({waiting.length})</span></h3><span className="dl-line" />
            <Link to="/settings/downloads" className="muted small">Auto-updates {store.settings.autoUpdates ? 'enabled' : 'disabled'}</Link></div>
          {waiting.length === 0 && <p className="muted dl-empty">There are no downloads in the queue</p>}
          {waiting.map(d => {
            const g = gameOf(d.id)
            return (
              <div className="dl-row" key={d.id}>
                <div className="dl-row-art"><Art game={g} kind="header" /></div>
                <div className="grow"><div className="dl-title small-title">{g.title}</div><div className="muted small">{d.paused ? 'Paused' : 'Queued'} · {g.sizeGb.toFixed(2)} GB</div></div>
                {d.paused ? <button className="btn small" onClick={() => store.resume(d.id)}>Resume</button> : <button className="btn small" onClick={() => store.moveToFront(d.id)}>Download next</button>}
                <button className="icon-btn" onClick={() => store.cancel(d.id)} aria-label={`Remove ${g.title} from queue`}><Icon name="trash" size={18} /></button>
              </div>
            )
          })}
        </section>

        <section>
          <div className="dl-head"><h3>Recently Completed <span className="muted">({store.completed.length})</span></h3><span className="dl-line" />
            {store.completed.length > 0 && <button className="link-btn small" onClick={() => (store.completed = [])}>Clear</button>}</div>
          {store.completed.length === 0 && <p className="muted dl-empty">Nothing has finished installing in this session</p>}
          {store.completed.map(c => {
            const g = gameOf(c.id)
            return (
              <div className="dl-row" key={`${c.id}-${c.at}`}>
                <div className="dl-row-art"><Art game={g} kind="header" /></div>
                <div className="grow"><Link to={`/library/${g.id}`} className="dl-title small-title">{g.title}</Link><div className="muted small">Installed · {g.sizeGb.toFixed(2)} GB</div></div>
                <Link to={`/library/${g.id}`} className="btn small">Open in Library</Link>
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
})
