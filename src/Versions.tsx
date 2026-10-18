import { useEffect, useState } from 'react'
import { api, call, store } from './store'
import { Modal, ago } from './ui'
import { fmt, type Game } from './data'

interface Ver { version: number; notes: string; at: number }

/** A game's properties: who made it, how big it is and every version released so far. */
export const PropertiesModal = ({ g, onClose }: { g: Game; onClose: () => void }) => {
  const [vers, setVers] = useState<Ver[] | null>(null)
  useEffect(() => { void api<{ versions: Ver[] }>('GET', `/games/${g.id}/versions`).then(r => setVers(r?.versions ?? [])) }, [g.id])
  return (
    <Modal title={`${g.title} — Properties`} onClose={onClose} width={520}>
      <dl className="kv">
        <dt>Version</dt><dd>{g.version ?? 1}</dd>
        <dt>Developer</dt><dd>{g.dev}</dd>
        <dt>Install size</dt><dd>{g.sizeGb ? `${g.sizeGb.toFixed(2)} GB` : 'n/a'}</dd>
        <dt>Game ID</dt><dd>{g.id}</dd>
      </dl>
      <h3 className="vr-h">Update history</h3>
      {vers === null ? <p className="muted small">Loading…</p> : vers.length === 0 ? <p className="muted small">No updates have been released yet.</p> : (
        <div className="vr-list">{vers.map(v => <div key={v.version} className="vr-row"><b>Version {v.version}</b> <span className="muted small">{ago(v.at)}</span><div className="vr-notes">{v.notes}</div></div>)}</div>
      )}
    </Modal>
  )
}

interface Elig { eligible: boolean; reason: string; cents: number; daysLeft: number; minutesPlayed: number }

/** Refund request: eligible within 14 days of purchase and under 2 hours played. */
export const RefundModal = ({ g, onClose }: { g: Game; onClose: () => void }) => {
  const [e, setE] = useState<Elig | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { void api<Elig>('GET', `/refund/${g.id}`).then(r => setE(r)) }, [g.id])
  return (
    <Modal title={`Refund ${g.title}`} onClose={onClose} width={460}>
      {e === null ? <p className="muted">Checking…</p> : e.eligible ? (
        <>
          <p>You can refund this purchase: it is within 14 days ({e.daysLeft} left) and you have played {e.minutesPlayed} of 120 minutes. <b>{fmt(e.cents)}</b> will go back to your wallet and the game will leave your library.</p>
          {err && <div className="err">{err}</div>}
          <div className="modal-actions"><button className="btn" onClick={onClose}>Keep the game</button>
            <button className="btn red" disabled={busy} onClick={async () => { setBusy(true); const r = await call('POST', `/refund/${g.id}`); setBusy(false); if (r.error) setErr(r.error); else { await store.hydrate(); store.toast(`${g.title} was refunded`); onClose(); location.hash = '#/library' } }}>Refund {fmt(e.cents)}</button></div>
        </>
      ) : (
        <>
          <p>This game cannot be refunded: {e.reason.toLowerCase()}.</p>
          <p className="muted small">Refunds are available for games bought with wallet funds, within 14 days of purchase and with less than 2 hours of play time.</p>
          <div className="modal-actions"><button className="btn" onClick={onClose}>Close</button></div>
        </>
      )}
    </Modal>
  )
}
