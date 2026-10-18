import { useEffect, useState } from 'react'
import { api } from './store'
import { Modal, ago } from './ui'
import type { Game } from './data'

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
