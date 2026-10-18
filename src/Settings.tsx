import { useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, fmt } from './data'
import { store, type Settings as S } from './store'
import { Icon } from './icons'
import { Art } from './art'
import { Avatar, Modal, hours, nameHue } from './ui'
import './settings.css'

const NAV: ([string, string, string] | null)[] = [
  ['account', 'Account', 'person'], ['friends', 'Friends & Chat', 'group'], ['family', 'Family', 'group'], ['security', 'Security', 'shield'], null,
  ['notifications', 'Notifications', 'bell'], ['interface', 'Interface', 'monitor'], ['store', 'Store', 'cart'], ['library', 'Library', 'grid'], ['downloads', 'Downloads', 'download'],
  ['storage', 'Storage', 'storage'], ['cloud', 'Cloud', 'cloud'], ['ingame', 'In Game', 'monitor'], ['accessibility', 'Accessibility', 'info'], null,
  ['controller', 'Controller', 'play'], ['recording', 'Game Recording', 'play'], ['voice', 'Voice', 'mic'],
]

const Row = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="setrow"><div><div className="sl">{label}</div>{hint && <div className="muted small">{hint}</div>}</div><div className="sctl">{children}</div></div>
)
// must be an observer: it reads the store directly, so it has to re-render when the value changes
const Toggle = observer(({ k }: { k: keyof S }) => <input type="checkbox" className="toggle" checked={store.settings[k] as boolean} onChange={e => ((store.settings[k] as boolean) = e.target.checked)} aria-label={String(k)} />)
const Stub = ({ name }: { name: string }) => <p className="muted">{name} settings are not available in the web version of reSteam.</p>

const AddFunds = ({ onClose }: { onClose: () => void }) => (
  <Modal title="Add funds to your wallet" onClose={onClose} width={420}>
    <p>Current balance: <b>{fmt(store.wallet)}</b>. This is play money for the demo.</p>
    <div className="amounts">{[500, 1000, 2000, 5000].map(a => <button key={a} className="btn blue" onClick={() => { store.addFunds(a); store.toast(`Added ${fmt(a)}`); onClose() }}>{fmt(a)}</button>)}</div>
  </Modal>
)

const Account = observer(() => {
  const nav = useNavigate()
  const [modal, setModal] = useState<null | 'funds' | 'privacy' | 'details' | 'email' | 'vac'>(null)
  const me = { name: store.name, hue: nameHue(store.name), status: store.status }
  return (
    <>
      <div className="acct-top">
        <Avatar f={me} size={88} ring={false} />
        <div className="grow"><div className="acct-name">{store.name}</div><div className="acct-status">{store.status === 'offline' ? 'Invisible' : store.status === 'away' ? 'Away' : 'Online'}</div></div>
        <button className="btn" onClick={() => nav('/profile')}>View Profile</button>
      </div>
      <div className="tiles3">
        <button className="tile3" onClick={() => setModal('funds')}><Icon name="card" size={46} /><b>Add Funds</b><span className="muted">Current Balance: {fmt(store.wallet)}</span></button>
        <button className="tile3" onClick={() => setModal('privacy')}><Icon name="eyeOff" size={46} /><b>Privacy Settings</b><span className="muted">Profile, Games, Inventory, Etc</span></button>
        <button className="tile3" onClick={() => setModal('details')}><Icon name="edit" size={46} /><b>Account Details</b><span className="muted">Store, Security, Family, Devices</span></button>
      </div>
      <div className="infobox"><span className="sl">Friend Code</span><span className="muted grow">{store.friendCode}</span><button className="btn" onClick={() => { store.friendsOpen = true }}>Add Friends</button></div>
      <div className="infobox"><span className="sl">Email Address</span><span className="muted grow">Not collected</span><button className="btn" onClick={() => setModal('email')}>Learn More</button></div>
      <div className="infobox"><span className="sl">Ban Status</span><span className="muted grow">No bans on account</span><button className="btn" onClick={() => setModal('vac')}>Learn More</button></div>
      {modal === 'funds' && <AddFunds onClose={() => setModal(null)} />}
      {modal === 'privacy' && (
        <Modal title="Privacy Settings" onClose={() => setModal(null)} width={420}>
          <label className="small muted">Who can see your profile and games</label>
          <select className="input" value={store.settings.profilePrivacy} onChange={e => (store.settings.profilePrivacy = e.target.value as S['profilePrivacy'])}>
            <option value="public">Public</option><option value="friends">Friends only</option><option value="private">Private</option>
          </select>
          <p className="muted small" style={{ marginTop: 12 }}>This preference is kept on this browser. There are no other users to hide from in the demo.</p>
        </Modal>
      )}
      {modal === 'details' && (
        <Modal title="Account Details" onClose={() => setModal(null)} width={420}>
          <dl className="kv"><dt>Display name</dt><dd>{store.name}</dd><dt>Friend code</dt><dd>{store.friendCode}</dd><dt>Games owned</dt><dd>{store.owned.length}</dd><dt>Sign-in</dt><dd>Anonymous session stored in this browser</dd></dl>
        </Modal>
      )}
      {modal === 'email' && <Modal title="Email address" onClose={() => setModal(null)} width={420}><p>reSteam never asks for an email address or any other personal information. Your account is an anonymous session in this browser.</p></Modal>}
      {modal === 'vac' && <Modal title="Ban status" onClose={() => setModal(null)} width={420}><p>There is no anti-cheat or ban system in this demo, so no account can be banned.</p></Modal>}
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

const BODY: Record<string, { title: string; el: () => ReactNode }> = {
  account: { title: 'Account', el: () => <Account /> },
  friends: { title: 'Friends & Chat', el: () => (<>
    <Row label="Show the friends tip again" hint="The dashed box above your friends list"><button className="btn small" onClick={() => (store.hints.drag = false)}>Reset</button></Row>
    <Row label="Open Friends & Chat now"><button className="btn small" onClick={() => (store.friendsOpen = true)}>Open</button></Row></>) },
  family: { title: 'Family', el: () => <Stub name="Family" /> },
  security: { title: 'Security', el: () => (<>
    <Row label="Reset this browser's account" hint="Starts a fresh anonymous account. Your current library and wallet become unreachable."><button className="btn red small" onClick={() => store.signOut()}>Reset</button></Row></>) },
  notifications: { title: 'Notifications', el: () => (<>
    <Row label="Play a sound for notifications"><Toggle k="notifySounds" /></Row>
    <Row label="Mark all notifications as read"><button className="btn small" onClick={() => store.markAllRead()}>Mark read</button></Row></>) },
  interface: { title: 'Interface', el: () => (<>
    <Row label="Display scale" hint={`${Math.round(store.settings.uiScale * 100)}% of the default size`}><input type="range" min={0.85} max={1.3} step={0.05} value={store.settings.uiScale} onChange={e => (store.settings.uiScale = Number(e.target.value))} aria-label="UI scale" /></Row>
    <Row label="Language"><select className="input" disabled value="en"><option value="en">English</option></select></Row></>) },
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
  cloud: { title: 'Cloud', el: () => <Row label="Enable cloud sync for saves" hint="Saves are not stored anywhere in this demo"><Toggle k="cloud" /></Row> },
  ingame: { title: 'In Game', el: () => (<>
    <Row label="Enable the in-game overlay"><Toggle k="overlay" /></Row>
    <Row label="Show an FPS counter while playing"><Toggle k="fpsCounter" /></Row></>) },
  accessibility: { title: 'Accessibility', el: () => <Row label="Reduce motion" hint="Turns off carousels and animations"><Toggle k="reduceMotion" /></Row> },
  controller: { title: 'Controller', el: () => <Stub name="Controller" /> },
  recording: { title: 'Game Recording', el: () => <Stub name="Game Recording" /> },
  voice: { title: 'Voice', el: () => <Stub name="Voice" /> },
}

export const SettingsPage = observer(() => {
  const { section } = useParams()
  const cur = BODY[section ?? '']
  if (!cur) return <Navigate to="/settings/account" replace />
  return (
    <div className="settings">
      <aside className="srail">
        <div className="stitle">RESTEAM SETTINGS</div>
        {NAV.map((n, i) => n === null ? <hr key={i} /> : (
          <NavLink key={n[0]} to={`/settings/${n[0]}`} className="sitem"><Icon name={n[2]} size={22} /> {n[1]}</NavLink>
        ))}
      </aside>
      <section className="sbody"><h1>{cur.title}</h1>{cur.el()}</section>
    </div>
  )
})

export const Profile = observer(() => {
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(store.name)
  const [msg, setMsg] = useState('')
  const me = { name: store.name, hue: nameHue(store.name), status: store.status }
  const total = Object.values(store.playtime).reduce((a, b) => a + b, 0)
  const level = Math.max(1, Math.floor(store.owned.length * 1.5 + total / 120))
  const recent = [...store.ownedGames].filter(g => store.lastPlayed[g.id]).sort((a, b) => (store.lastPlayed[b.id] ?? 0) - (store.lastPlayed[a.id] ?? 0)).slice(0, 4)
  const fav = store.ownedGames.find(g => store.favorites.includes(g.id))
  return (
    <div className="profile">
      <div className="pf-wrap">
        <div className="pf-head">
          <div className="pf-avatar"><Avatar f={me} size={160} /></div>
          <div className="grow">
            <h1>{store.name}</h1>
            <div className="muted">{store.status === 'offline' ? 'Invisible' : store.status === 'away' ? 'Away' : 'Currently Online'}</div>
            <div className="pf-btns"><button className="btn" onClick={() => setEdit(true)}>Edit Profile</button><Link to="/settings/account" className="btn">Account</Link></div>
          </div>
          <div className="pf-level"><div className="lvl">{level}</div><div className="muted small">Level</div></div>
        </div>
        <div className="pf-cols">
          <div>
            <h2>Recent Activity</h2>
            <div className="muted small pf-hrs">{hours(total)} on record</div>
            {recent.length === 0 && <p className="muted">Play a game and it will show up here.</p>}
            {recent.map(g => (
              <Link key={g.id} to={`/library/${g.id}`} className="pf-game"><div className="pf-art"><GameArt id={g.id} /></div>
                <div><div className="pf-gname">{g.title}</div><div className="muted small">{hours(store.playtime[g.id])} on record</div></div></Link>
            ))}
            {fav && (<><h2 className="mt">Favorite Game</h2><Link to={`/library/${fav.id}`} className="pf-game"><div className="pf-art"><GameArt id={fav.id} /></div><div className="pf-gname">{fav.title}</div></Link></>)}
          </div>
          <aside>
            <div className="pf-stats">
              {([['Games', store.owned.length], ['Installed', store.installed.length], ['Friends', store.friends.filter(f => f.status !== 'pending').length], ['Wishlist', store.wishlist.length]] as const).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
            </div>
          </aside>
        </div>
      </div>
      {edit && (
        <Modal title="Edit Profile" onClose={() => setEdit(false)} width={420}>
          <form onSubmit={async e => { e.preventDefault(); const err = await store.setName(name); setMsg(err ?? 'Saved'); if (!err) setTimeout(() => setEdit(false), 400) }}>
            <label className="small muted">Profile name</label>
            <input className="input" autoFocus value={name} maxLength={20} onChange={e => { setName(e.target.value); setMsg('') }} />
            {msg && <div className={`small ${msg === 'Saved' ? 'pos' : 'err'}`}>{msg}</div>}
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setEdit(false)}>Cancel</button><button className="btn blue" disabled={name.trim() === store.name}>Save</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
})

const GameArt = ({ id }: { id: number }) => <Art game={GAMES.find(g => g.id === id)!} kind="header" />
