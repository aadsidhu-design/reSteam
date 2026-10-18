import { useState, type ReactNode } from 'react'
import { t } from './i18n'
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, fmt } from './data'
import { store, type Privacy, type Settings as S } from './store'
import { Icon } from './icons'
import { Modal } from './ui'
import './settings.css'

const NAV: ([string, string, string] | null)[] = [
  ['account', 'set.account', 'person'], ['friends', 'friends.title', 'group'], ['security', 'set.security', 'shield'], null,
  ['notifications', 'set.notifications', 'bell'], ['interface', 'set.interface', 'monitor'], ['store', 'set.store', 'cart'], ['library', 'nav.library', 'grid'], ['downloads', 'lib.downloads', 'download'],
  ['storage', 'set.storage', 'storage'], ['ingame', 'In Game', 'monitor'], ['accessibility', 'set.accessibility', 'info'],
]

const Row = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="setrow"><div><div className="sl">{label}</div>{hint && <div className="muted small">{hint}</div>}</div><div className="sctl">{children}</div></div>
)
// must be an observer: it reads the store directly, so it has to re-render when the value changes
const Toggle = observer(({ k }: { k: keyof S }) => <input type="checkbox" className="toggle" checked={store.settings[k] as boolean} onChange={e => ((store.settings[k] as boolean) = e.target.checked)} aria-label={String(k)} />)

const AddFunds = ({ onClose }: { onClose: () => void }) => (
  <Modal title="Add funds to your wallet" onClose={onClose} width={420}>
    <p>Current balance: <b>{fmt(store.wallet)}</b>. reSteam wallet funds are play money; no payment is taken.</p>
    <div className="amounts">{[500, 1000, 2000, 5000].map(a => <button key={a} className="btn blue" onClick={async () => { const e = await store.addFunds(a); store.toast(e ?? `Added ${fmt(a)}`); if (!e) onClose() }}>{fmt(a)}</button>)}</div>
  </Modal>
)

const PasswordForm = () => {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <form className="pwform" onSubmit={async e => {
      e.preventDefault()
      if (next !== again) { setMsg({ ok: false, text: 'The new passwords do not match.' }); return }
      const err = await store.changePassword(cur, next)
      setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Password changed. Your other devices were signed out.' })
      if (!err) { setCur(''); setNext(''); setAgain('') }
    }}>
      <input className="input" type="password" autoComplete="current-password" placeholder="Current password" value={cur} onChange={e => setCur(e.target.value)} />
      <input className="input" type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={next} onChange={e => setNext(e.target.value)} />
      <input className="input" type="password" autoComplete="new-password" placeholder="Confirm new password" value={again} onChange={e => setAgain(e.target.value)} />
      {msg && <div className={`small ${msg.ok ? 'pos' : 'err'}`}>{msg.text}</div>}
      <button className="btn blue" disabled={!cur || !next}>Change password</button>
    </form>
  )
}

const DeleteAccount = ({ onClose }: { onClose: () => void }) => {
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  return (
    <Modal title="Delete account" onClose={onClose} width={440}>
      <p>This permanently deletes your account, library, wallet, friends and messages. It cannot be undone. Enter your password to confirm.</p>
      <form onSubmit={async e => { e.preventDefault(); const r = await store.deleteAccount(pw); if (r) setErr(r); else nav('/store') }}>
        <input className="input" type="password" autoFocus autoComplete="current-password" placeholder="Password" value={pw} onChange={e => { setPw(e.target.value); setErr('') }} />
        {err && <div className="err">{err}</div>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn red" disabled={!pw}>Delete my account</button></div>
      </form>
    </Modal>
  )
}

const Bar = ({ icon, children }: { icon: Parameters<typeof Icon>[0]['name']; children: ReactNode }) => <div className="acct-bar"><Icon name={icon} size={18} /> {children}</div>

const Account = observer(() => {
  const nav = useNavigate()
  const [modal, setModal] = useState<null | 'funds' | 'privacy' | 'details' | 'licenses'>(null)
  return (
    <>
      <div className="acct-sec">
        <Bar icon="cart">Store &amp; Purchase History</Bar>
        <div className="acct-cols">
          <div>
            <button className="abtn" onClick={() => setModal('funds')}>+ Add funds to your reSteam Wallet</button>
            <div className="acct-wallet"><a>Wallet Balance</a><b>{fmt(store.wallet)}</b></div>
            <div className="acct-rule" />
            <p className="muted small">Wallet funds are play money. No payment methods exist on this account.</p>
          </div>
          <div className="acct-btns">
            <button className="abtn" onClick={() => setModal('licenses')}>View licenses and product key activations</button>
            <button className="abtn" onClick={() => nav('/settings/store')}>Update store preferences</button>
            <button className="abtn" onClick={() => nav('/developer')}>Manage your published games</button>
          </div>
        </div>
      </div>
      <div className="acct-sec">
        <Bar icon="person">Account Info</Bar>
        <div className="acct-cols">
          <dl className="kv">
            <dt>Account name</dt><dd>{store.user?.username}</dd>
            <dt>Display name</dt><dd>{store.name}</dd>
            <dt>Games owned</dt><dd>{store.owned.length}</dd>
            <dt>Email address</dt><dd className="muted">Not collected</dd>
          </dl>
          <div className="acct-btns">
            <button className="abtn" onClick={() => nav('/profile')}>View my profile</button>
            <button className="abtn" onClick={() => setModal('privacy')}>Privacy settings</button>
            <button className="abtn" onClick={() => nav('/settings/security')}>Change password</button>
            <button className="abtn" onClick={() => { store.friendsOpen = true }}>Add friends</button>
          </div>
        </div>
      </div>
      {modal === 'funds' && <AddFunds onClose={() => setModal(null)} />}
      {modal === 'licenses' && (
        <Modal title="Licenses" onClose={() => setModal(null)} width={520}>
          <p className="muted small">Games in your library and the product codes you have activated.</p>
          <div className="lic-list">{store.ownedGames.map(g => <div key={g.id} className="lic-row"><b>{g.title}</b><span className="muted small">{g.price === 0 ? 'Free to play' : fmt(g.price)}</span></div>)}</div>
          {store.ownedGames.length === 0 && <p className="muted">No games yet.</p>}
        </Modal>
      )}
      {modal === 'privacy' && (
        <Modal title="Privacy Settings" onClose={() => setModal(null)} width={420}>
          <label className="small muted">Who can see your profile, games and activity</label>
          <select className="input" value={store.privacy} onChange={e => void store.setPrivacy(e.target.value as Privacy)}>
            <option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private</option>
          </select>
          <p className="muted small" style={{ marginTop: 12 }}>Public profiles show your name, level and recent games to everyone. Friends only limits that to your friends. Private shows only your name.</p>
        </Modal>
      )}
      {modal === 'details' && <Modal title="Account Details" onClose={() => setModal(null)} width={420}>
        <dl className="kv"><dt>Display name</dt><dd>{store.name}</dd><dt>Account name</dt><dd>{store.user?.username}</dd><dt>Games owned</dt><dd>{store.owned.length}</dd></dl>
      </Modal>}
    </>
  )
})

const Storage = observer(() => {
  const list = store.installed.map(id => GAMES.find(g => g.id === id)!).filter(Boolean)
  const total = 256
  return (
    <>
      <Row label="Local drive" hint="Space used by installed games"><b>{store.storageUsedGb.toFixed(1)} GB</b> <span className="muted">of {total} GB</span></Row>
      <div className="stbar"><span style={{ width: `${Math.min(100, (store.storageUsedGb / total) * 100)}%` }} /></div>
      {list.length === 0 && <p className="muted">No games are installed.</p>}
      {list.map(g => <Row key={g.id} label={g.title} hint={`${g.sizeGb.toFixed(1)} GB`}><button className="btn small" disabled={store.running === g.id} onClick={() => store.uninstall(g.id)}>Uninstall</button></Row>)}
    </>
  )
})

const SecurityPane = observer(() => {
  const nav = useNavigate()
  const [del, setDel] = useState(false)
  return (
    <>
      <h2>Change password</h2>
      <PasswordForm />
      <h2 className="mt">Session</h2>
      <Row label="Sign out of this browser"><button className="btn small" onClick={() => void store.signOut().then(() => nav('/store'))}>Sign out</button></Row>
      <h2 className="mt">Danger zone</h2>
      <Row label="Delete my account" hint="Removes your library, wallet, friends and messages for good."><button className="btn red small" onClick={() => setDel(true)}>Delete…</button></Row>
      {del && <DeleteAccount onClose={() => setDel(false)} />}
    </>
  )
})

const BODY: Record<string, { title: string; el: () => ReactNode }> = {
  account: { title: 'Account', el: () => <Account /> },
  friends: { title: 'Friends & Chat', el: () => (<>
    <Row label="Show the friends tip again" hint="The dashed box above your friends list"><button className="btn small" onClick={() => (store.hints.drag = false)}>Reset</button></Row>
    <Row label="Open Friends & Chat now"><button className="btn small" onClick={() => (store.friendsOpen = true)}>Open</button></Row></>) },
  security: { title: 'Security', el: () => <SecurityPane /> },
  notifications: { title: 'Notifications', el: () => (<>
    <Row label="Play a sound for notifications"><Toggle k="notifySounds" /></Row>
    <Row label="Mark all notifications as read"><button className="btn small" onClick={() => void store.markAllRead()}>Mark read</button></Row></>) },
  interface: { title: 'Interface', el: () => (<>
    <Row label="Display scale" hint={`${Math.round(store.settings.uiScale * 100)}% of the default size`}><input type="range" min={0.85} max={1.3} step={0.05} value={store.settings.uiScale} onChange={e => (store.settings.uiScale = Number(e.target.value))} aria-label="UI scale" /></Row>
  </>) },
  store: { title: 'Store', el: () => (<>
    <Row label="Recently viewed" hint={`${store.viewed.length} items`}><button className="btn small" onClick={() => (store.viewed = [])}>Clear</button></Row></>) },
  library: { title: 'Library', el: () => (<>
    <Row label="Open the library as a poster grid"><input type="checkbox" className="toggle" checked={store.libraryGrid} onChange={e => (store.libraryGrid = e.target.checked)} aria-label="Grid view" /></Row>
    <Row label="Poster size" hint={`${store.settings.gridSize}px wide`}><input type="range" min={110} max={240} step={10} value={store.settings.gridSize} onChange={e => (store.settings.gridSize = Number(e.target.value))} aria-label="Poster size" /></Row>
    <Row label="Restore default shelves"><button className="btn small" onClick={() => (store.shelves = ['whatsnew', 'recent'])}>Restore</button></Row></>) },
  downloads: { title: 'Downloads', el: () => (<>
    <Row label="Limit download speed" hint="Applies to the simulated downloads"><select className="input" value={store.settings.bandwidthLimit} onChange={e => (store.settings.bandwidthLimit = Number(e.target.value))} aria-label="Bandwidth limit">
      <option value={0}>No limit</option><option value={5}>5 MB/s</option><option value={20}>20 MB/s</option><option value={50}>50 MB/s</option><option value={100}>100 MB/s</option></select></Row>
    <Row label="Keep games up to date automatically"><Toggle k="autoUpdates" /></Row>
    <Row label="Allow downloads while playing" hint="Off pauses installs until you stop the game"><Toggle k="downloadsDuringGame" /></Row></>) },
  storage: { title: 'Storage', el: () => <Storage /> },
  ingame: { title: 'In Game', el: () => (<>
    <Row label="Enable the in-game overlay"><Toggle k="overlay" /></Row>
    <Row label="Show an FPS counter while playing"><Toggle k="fpsCounter" /></Row></>) },
  accessibility: { title: 'Accessibility', el: () => <Row label="Reduce motion" hint="Turns off carousels and animations"><Toggle k="reduceMotion" /></Row> },
}

export const SettingsPage = observer(() => {
  const { section } = useParams()
  const cur = BODY[section ?? '']
  if (!cur) return <Navigate to="/settings/account" replace />
  return (
    <div className="settings">
      <div className="settings-in">
        <div className="acct-crumbs"><Link to="/store">Home</Link> &gt; <span>Account</span></div>
        <h1 className="acct-h1">{t('settings.title', { name: store.name })}</h1>
        <div className="acct-sub">Account name: {store.user?.username}</div>
        <div className="settings-grid">
          <aside className="srail">
            {NAV.map((n, i) => n === null ? <hr key={i} /> : (
              <NavLink key={n[0]} to={`/settings/${n[0]}`} className="sitem">{n[1].includes('.') ? t(n[1]) : n[1]}</NavLink>
            ))}
          </aside>
          <section className="sbody"><h2 className="sec-title">{cur.title}</h2>{cur.el()}</section>
        </div>
      </div>
    </div>
  )
})
