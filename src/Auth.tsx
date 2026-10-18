import { useEffect, useMemo, useRef, useState } from 'react'
import { t } from './i18n'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import qrcode from 'qrcode-generator'
import { api, call, store } from './store'
import { Loading, Logo } from './ui'
import './auth.css'

type Mode = 'signin' | 'join' | 'recover'

/** SVG QR code for a sign-in URL. */
function Qr({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(text)
    q.make()
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
  }, [text])
  return <div className="qr" aria-label="Sign-in QR code" dangerouslySetInnerHTML={{ __html: svg }} />
}

/** Waits for another signed-in device to approve this browser. */
const QrPanel = observer(({ onDone }: { onDone: () => void }) => {
  const [req, setReq] = useState<{ id: string; secret: string } | null>(null)
  const [state, setState] = useState<'wait' | 'expired' | 'error'>('wait')
  const [round, setRound] = useState(0)
  useEffect(() => {
    let dead = false
    let timer: ReturnType<typeof setTimeout>
    setReq(null); setState('wait')
    void (async () => {
      const r = await api<{ id: string; secret: string }>('POST', '/auth/qr/begin')
      if (dead) return
      if (!r) { setState('error'); return }
      setReq(r)
      const poll = async () => {
        const res = await call<{ status: string }>('POST', '/auth/qr/poll', r)
        if (dead) return
        if (res.data?.status === 'approved') { await store.bootstrap(); onDone(); return }
        if (res.data?.status === 'expired' || res.status === 404) { setState('expired'); return }
        timer = setTimeout(poll, 2000)
      }
      timer = setTimeout(poll, 2000)
    })()
    return () => { dead = true; clearTimeout(timer) }
  }, [round]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="auth-qr">
      <div className="auth-sub">{t('auth.qr')}</div>
      {req && state === 'wait' ? <Qr text={`${location.origin}${location.pathname}#/qr/${req.id}`} /> : <div className="qr qr-off">{state === 'wait' ? 'Loading…' : state === 'expired' ? 'Code expired' : 'Unavailable'}</div>}
      {state !== 'wait' && <button className="btn small" onClick={() => setRound(round + 1)}>{t('au.newcode')}</button>}
      <p className="small muted">{t('au.qrhelp')}</p>
    </div>
  )
})

function RecoveryKey({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  return (
    <div className="auth-card narrow">
      <h1>{t('au.savekey')}</h1>
      <p>{t('au.keydesc')}</p>
      <div className="recovery-code" data-testid="recovery-code">{code}</div>
      <div className="row gap">
        <button className="btn" onClick={() => void navigator.clipboard?.writeText(code).then(() => store.toast('Recovery key copied'))}>{t('au.copy')}</button>
      </div>
      <label className="check"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} /> I have stored my recovery key somewhere safe</label>
      <button className="btn blue big" disabled={!saved} onClick={onDone}>{t('au.continue')}</button>
    </div>
  )
}

export const LoginPage = observer(() => {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/store'
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'join' ? 'join' : 'signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [newKey, setNewKey] = useState<{ code: string; message?: string } | null>(null)
  const done = useRef(false)
  const registering = useRef(false)

  if (store.account === 'in' && !newKey && !done.current && !registering.current) return <Navigate to={next} replace />
  if (store.account === 'loading') return <div className="auth-page"><Loading /></div>

  const switchTo = (m: Mode) => { setMode(m); setErr(''); setPassword(''); setConfirm('') }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (mode !== 'signin' && password !== confirm) { setErr('The passwords you entered do not match.'); return }
    setBusy(true)
    try {
      if (mode === 'signin') {
        const r = await store.signIn(username.trim(), password, remember)
        if (r) setErr(r); else nav(next, { replace: true })
      } else if (mode === 'join') {
        registering.current = true
        const r = await store.register(username.trim(), password, remember)
        if (r.error) { registering.current = false; setErr(r.error) } else setNewKey({ code: r.recoveryCode! })
      } else {
        const r = await store.recover(username.trim(), code.trim(), password)
        if (r.error) setErr(r.error); else { setNewKey({ code: r.recoveryCode!, message: 'Your password was changed. Sign in with your new password.' }); done.current = true }
      }
    } finally { setBusy(false) }
  }

  if (newKey) {
    return (
      <div className="auth-page">
        {newKey.message && <div className="auth-ok">{newKey.message}</div>}
        <RecoveryKey code={newKey.code} onDone={() => { done.current = true; if (store.account === 'in') nav(next, { replace: true }); else { setNewKey(null); switchTo('signin') } }} />
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-form">
          <div className="auth-logo"><Logo size={34} /><span>reSteam</span></div>
          <h1>{mode === 'signin' ? t('auth.signin') : mode === 'join' ? t('auth.create') : t('auth.reset')}</h1>
          <form onSubmit={submit} autoComplete="on">
            <label className="auth-sub" htmlFor="u">{mode === 'signin' ? t('auth.withname') : t('auth.account')}</label>
            <input id="u" className="input" name="username" autoComplete="username" autoFocus value={username} onChange={e => setUsername(e.target.value)} maxLength={24} />
            {mode === 'recover' && (<>
              <label className="auth-sub" htmlFor="rc">{t('au.reckey')}</label>
              <input id="rc" className="input mono" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoComplete="off" />
            </>)}
            <label className="auth-sub" htmlFor="p">{mode === 'recover' ? t('auth.password') : t('auth.password')}</label>
            <input id="p" className="input" type="password" name="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} />
            {mode !== 'signin' && (<>
              <label className="auth-sub" htmlFor="p2">{t('auth.confirm')}</label>
              <input id="p2" className="input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              <div className="small muted">{t('au.pwhint')}</div>
            </>)}
            {mode !== 'recover' && <label className="check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> {t('auth.remember')}</label>}
            {err && <div className="err" role="alert">{err}</div>}
            <button className="btn blue big auth-submit" disabled={busy || !username.trim() || !password}>{mode === 'signin' ? t('auth.signin') : mode === 'join' ? t('auth.createbtn') : t('auth.changepw')}</button>
          </form>
          <div className="auth-links">
            {mode === 'signin' && <><button className="link-btn" onClick={() => switchTo('recover')}>{t('auth.help')}</button><button className="link-btn" onClick={() => switchTo('join')}>{t('auth.newacct')}</button></>}
            {mode !== 'signin' && <button className="link-btn" onClick={() => switchTo('signin')}>{t('auth.back')}</button>}
          </div>
        </div>
        {mode === 'signin' && <QrPanel onDone={() => nav(next, { replace: true })} />}
      </div>
    </div>
  )
})

/** Opened from a QR code on a device that is already signed in. */
export const QrApprove = observer(() => {
  const { id } = useParams()
  const [state, setState] = useState<'checking' | 'ready' | 'done' | 'gone'>('checking')
  useEffect(() => {
    if (store.account !== 'in') return
    void call('GET', `/auth/qr/${id}`).then(r => setState(r.error ? 'gone' : 'ready'))
  }, [id, store.account])
  if (store.account === 'loading') return null
  if (store.account === 'out') return <Navigate to={`/login?next=${encodeURIComponent(`/qr/${id}`)}`} replace />
  return (
    <div className="auth-page">
      <div className="auth-card narrow">
        <h1>{t('au.approve')}</h1>
        {state === 'checking' && <p className="muted">{t('au.checking')}</p>}
        {state === 'gone' && <p>{t('au.expired')}</p>}
        {state === 'ready' && (<>
          <p>{t('au.asking')} <b>{store.name}</b>. Only approve this if you started it just now.</p>
          <div className="row gap">
            <button className="btn blue" onClick={async () => { const r = await call('POST', `/auth/qr/${id}/approve`); if (r.error) setState('gone'); else setState('done') }}>{t('au.approvebtn')}</button>
            <Link className="btn" to="/store">{t('pf.cancel')}</Link>
          </div>
        </>)}
        {state === 'done' && <p className="pos">{t('au.approved')}</p>}
      </div>
    </div>
  )
})

/** Wraps pages that need an account. */
export const RequireAuth = observer(({ children }: { children: React.ReactNode }) => {
  if (store.account === 'loading') return <div className="auth-page"><Loading /></div>
  if (store.account === 'out') return <Navigate to={`/login?next=${encodeURIComponent(location.hash.replace(/^#/, '') || '/store')}`} replace />
  return <>{children}</>
})
