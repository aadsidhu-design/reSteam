import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { api, call, store } from './store'
import { Modal, ago } from './ui'
import { t } from './i18n'

type Status = { enabled: boolean; backupCodesLeft: number }
type Dev = { id: string; current: boolean; createdAt: number; lastSeen: number; agent: string; country: string | null }
type Ev = { kind: string; at: number; country: string | null; agent: string | null }

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="setrow"><div><div className="sl">{label}</div>{hint && <div className="muted small">{hint}</div>}</div><div className="sctl">{children}</div></div>
)

const KINDS: Record<string, string> = {
  login: 'Signed in', login_failed: 'Wrong password', guard_failed: 'Wrong reGuard code', guard_on: 'reGuard turned on',
  guard_off: 'reGuard turned off', sessions_revoked: 'Devices signed out',
}

function SetupDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [info, setInfo] = useState<{ secret: string; uri: string } | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [backup, setBackup] = useState<string[] | null>(null)
  useEffect(() => { void call<{ secret: string; uri: string }>('POST', '/auth/guard/setup').then(r => r.data ? setInfo(r.data) : setErr(r.error ?? 'Could not start setup')) }, [])
  const enable = async () => {
    const r = await call<{ backupCodes: string[] }>('POST', '/auth/guard/enable', { code })
    if (r.data) { setBackup(r.data.backupCodes); onDone() } else setErr(r.error ?? 'That code is not right')
  }
  if (backup) return (
    <Modal title={t('gd.backup')} onClose={onClose} width={440}>
      <p>{t('gd.backuphint')}</p>
      <div className="mono guard-codes">{backup.map(b => <div key={b}>{b}</div>)}</div>
      <div className="modal-actions"><button className="btn blue" onClick={onClose}>{t('gd.saved')}</button></div>
    </Modal>
  )
  return (
    <Modal title={t('gd.setup')} onClose={onClose} width={460}>
      <p>{t('gd.step1')}</p>
      <div className="mono guard-secret">{info?.secret ?? '…'}</div>
      {info && <p className="small muted">{t('gd.uri')} <a href={info.uri}>otpauth link</a></p>}
      <p>{t('gd.step2')}</p>
      <input className="input mono" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={e => { setCode(e.target.value); setErr('') }} maxLength={8} />
      {err && <div className="err" role="alert">{err}</div>}
      <div className="modal-actions"><button className="btn" onClick={onClose}>{t('pf.cancel')}</button><button className="btn blue" disabled={code.trim().length < 6} onClick={() => void enable()}>{t('gd.turnon')}</button></div>
    </Modal>
  )
}

function DisableDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pw, setPw] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState('')
  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    const r = await call('POST', '/auth/guard/disable', { password: pw, code })
    if (r.error) setErr(r.error); else { onDone(); onClose() }
  }
  return (
    <Modal title={t('gd.turnoff')} onClose={onClose} width={420}>
      <form onSubmit={go}>
        <input className="input" type="password" autoComplete="current-password" placeholder={t('auth.password')} value={pw} onChange={e => { setPw(e.target.value); setErr('') }} />
        <input className="input mono" style={{ marginTop: 8 }} autoComplete="one-time-code" placeholder={t('au.guardcode')} value={code} onChange={e => { setCode(e.target.value); setErr('') }} />
        {err && <div className="err" role="alert">{err}</div>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>{t('pf.cancel')}</button><button className="btn red" disabled={!pw || !code}>{t('gd.turnoff')}</button></div>
      </form>
    </Modal>
  )
}

/** reGuard (authenticator-app second factor), signed-in devices and the recent security log. */
export const GuardSection = observer(() => {
  const [st, setSt] = useState<Status | null>(null)
  const [devs, setDevs] = useState<Dev[]>([])
  const [events, setEvents] = useState<Ev[]>([])
  const [dlg, setDlg] = useState<null | 'on' | 'off'>(null)
  const load = async () => {
    const [g, d, e] = await Promise.all([api<Status>('GET', '/auth/guard'), api<{ sessions: Dev[] }>('GET', '/auth/sessions'), api<{ events: Ev[] }>('GET', '/auth/events')])
    if (g) setSt(g)
    setDevs(d?.sessions ?? []); setEvents(e?.events ?? [])
  }
  useEffect(() => { void load() }, [store.account])
  return (
    <>
      <h2 className="mt">reGuard</h2>
      <Row label={t('gd.title')} hint={st?.enabled ? `${t('gd.on')} · ${st.backupCodesLeft} ${t('gd.codesleft')}` : t('gd.off')}>
        {st?.enabled
          ? <button className="btn small red" onClick={() => setDlg('off')}>{t('gd.turnoff')}</button>
          : <button className="btn small blue" onClick={() => setDlg('on')}>{t('gd.turnon')}</button>}
      </Row>
      <h2 className="mt">{t('gd.devices')}</h2>
      {devs.map(d => (
        <Row key={d.id} label={`${d.agent.split(' ').slice(-2).join(' ') || 'Browser'}${d.country ? ` · ${d.country}` : ''}`} hint={`${t('gd.lastactive')} ${ago(d.lastSeen)}`}>
          {d.current ? <span className="muted small">{t('gd.thisdevice')}</span> : <button className="btn small" onClick={async () => { await call('DELETE', `/auth/sessions/${d.id}`); void load() }}>{t('gd.signout')}</button>}
        </Row>
      ))}
      {devs.length > 1 && <Row label={t('gd.signoutall')}><button className="btn small" onClick={async () => { await call('POST', '/auth/sessions/revoke-others'); store.toast(t('gd.done')); void load() }}>{t('gd.signout')}</button></Row>}
      <h2 className="mt">{t('gd.log')}</h2>
      {events.slice(0, 10).map((e, i) => <div key={i} className="setrow"><div><div className="sl">{KINDS[e.kind] ?? e.kind}</div></div><div className="sctl muted small">{ago(e.at)}{e.country ? ` · ${e.country}` : ''}</div></div>)}
      {dlg === 'on' && <SetupDialog onClose={() => setDlg(null)} onDone={() => void load()} />}
      {dlg === 'off' && <DisableDialog onClose={() => setDlg(null)} onDone={() => void load()} />}
    </>
  )
})
