import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { api, call, store } from './store'
import { Loading, ago } from './ui'
import './admin.css'

interface Report { id: number; target: string; reason: string; at: number; reporter: string }
interface Pending { id: number; title: string; blurb: string; at: number; owner: string }

/** Moderation queue: games waiting for approval and user reports. Only accounts listed in ADMIN_USERNAMES can open it. */
export const Admin = observer(() => {
  const [data, setData] = useState<{ reports: Report[]; pending: Pending[] } | null>(null)
  const load = useCallback(async () => { setData(await api('GET', '/admin/overview')) }, [])
  useEffect(() => { if (store.admin) void load() }, [load, store.admin])
  if (!store.signedIn) return <Navigate to="/login?next=/admin" replace />
  if (!store.admin) return <div className="container"><h1>Moderation</h1><p className="muted">This page is only for moderators.</p></div>
  if (!data) return <Loading />
  const reasonFor = async (what: string) => window.prompt(`Reason shown to the owner (${what}):`, '')?.trim() || null
  return (
    <div className="container adm">
      <h1>Moderation</h1>
      <h2>Waiting for approval ({data.pending.length})</h2>
      {data.pending.length === 0 && <p className="muted">Nothing is waiting.</p>}
      {data.pending.map(p => (
        <div key={p.id} className="adm-row">
          <div className="grow"><b>{p.title}</b> <span className="muted small">by {p.owner} · {ago(p.at)}</span><div className="muted small">{p.blurb}</div></div>
          <button className="btn small green" onClick={async () => { await call('POST', `/admin/games/${p.id}/approve`); await store.loadCatalog(); void load() }}>Approve</button>
          <button className="btn small red" onClick={async () => { const r = await reasonFor('reject'); if (r) { await call('POST', `/admin/games/${p.id}/takedown`, { reason: r }); void load() } }}>Reject</button>
        </div>
      ))}
      <h2>Reports ({data.reports.length})</h2>
      {data.reports.length === 0 && <p className="muted">No open reports.</p>}
      {data.reports.map(r => {
        const [kind, id] = r.target.split(':')
        const link = kind === 'game' ? `/store/${id}` : kind === 'post' ? `/community?post=${id}` : null
        return (
          <div key={r.id} className="adm-row">
            <div className="grow"><b>{kind}</b> {link ? <Link to={link}>#{id}</Link> : `#${id}`} <span className="muted small">reported by {r.reporter} · {ago(r.at)}</span><div className="muted small">{r.reason}</div></div>
            {kind === 'game' && <button className="btn small red" onClick={async () => { const why = await reasonFor('take down'); if (why) { await call('POST', `/admin/games/${id}/takedown`, { reason: why }); await store.loadCatalog(); void load() } }}>Take down</button>}
            <button className="btn small" onClick={async () => { await call('POST', `/admin/reports/${r.id}/dismiss`); void load() }}>Dismiss</button>
          </div>
        )
      })}
    </div>
  )
})
