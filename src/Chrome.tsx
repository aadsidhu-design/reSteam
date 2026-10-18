import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, fmt } from './data'
import { notificationText, store } from './store'
import { Icon } from './icons'
import { Avatar, Logo, Modal, ago, useDismiss } from './ui'
import './shell.css'

export const Header = observer(() => {
  const nav = useNavigate()
  const path = useLocation().pathname
  const [menu, setMenu] = useState<'bell' | 'user' | null>(null)
  const ref = useDismiss(menu !== null, () => setMenu(null))
  const isStore = path.startsWith('/store') || path === '/cart' || path === '/wishlist'
  const isCommunity = path.startsWith('/community')
  const isLibrary = path.startsWith('/library') || path.startsWith('/downloads')
  const isAbout = path.startsWith('/about')
  const dl = store.activeDownload ?? store.queue[0]
  const dlGame = dl ? GAMES.find(g => g.id === dl.id) : undefined
  const me = { name: store.name, status: store.status === 'offline' ? 'offline' : store.running !== null ? 'ingame' : store.status }

  return (
    <header className="gheader">
      <div className={`gh-inner ${isCommunity || path.startsWith('/profile') ? 'narrow' : ''}`}>
        <Link to="/store" className="gh-logo" aria-label="reSteam home"><Logo size={36} /><span>reSteam</span></Link>
        <nav className="gh-nav">
          <NavLink to="/store" className={isStore ? 'active' : ''}>STORE</NavLink>
          <NavLink to="/library" className={isLibrary ? 'active' : ''}>LIBRARY</NavLink>
          <NavLink to="/community" className={isCommunity ? 'active' : ''}>COMMUNITY</NavLink>
          {store.signedIn && <NavLink to="/profile" className={path === '/profile' || path.startsWith('/profile/') ? 'active' : ''}>{store.name.toUpperCase()}</NavLink>}
          <NavLink to="/about" className={isAbout ? 'active' : ''}>ABOUT</NavLink>
        </nav>
        <div className="grow" />
        {dl && dlGame && (
          <button className="gh-dl" onClick={() => nav('/downloads')} title="Manage downloads">
            <Icon name="download" size={16} />
            <span className="gh-dl-bar"><span style={{ width: `${dl.progress}%` }} /></span>
            <span className="small">{store.activeDownload ? Math.floor(dl.progress) + '%' : 'Paused'}</span>
          </button>
        )}
        {store.account === 'in' ? (
          <div className="gh-right" ref={ref}>
            <Link to="/developer" className="gh-install"><Icon name="plus" size={13} /> Upload a game</Link>
            <Link to="/wishlist" className="gh-link">Wishlist ({store.wishlist.length})</Link>
            <Link to="/cart" className="gh-link"><Icon name="cart" size={15} /> Cart ({store.cart.length})</Link>
            <div className="popwrap">
              <button className="gh-icon" onClick={() => { setMenu(menu === 'bell' ? null : 'bell') }} aria-label="Notifications">
                <Icon name="bell" size={20} />
                {store.unreadCount > 0 && <span className="count">{store.unreadCount}</span>}
              </button>
              {menu === 'bell' && (
                <div className="popover right bell-pop">
                  <div className="pop-title row-between">Notifications <button className="link-btn small" onClick={() => void store.markAllRead()}>Mark all read</button></div>
                  {store.notifications.length === 0 && <div className="pop-item static read">You are all caught up.</div>}
                  {store.notifications.slice(0, 20).map(n => {
                    const from = n.data.from?.username as string | undefined
                    const pending = n.kind === 'friend_request' && from && store.incoming.some(r => r.username === from)
                    return (
                      <div key={n.id} className={`pop-item static ${n.read ? 'read' : ''}`}>
                        <div>{notificationText(n)}</div>
                        <div className="muted small">{ago(n.at)}</div>
                        {pending && (
                          <div className="req-actions">
                            <button className="btn small green" onClick={() => void store.acceptRequest(from!)}>Accept</button>
                            <button className="btn small" onClick={() => void store.declineRequest(from!)}>Ignore</button>
                          </div>
                        )}
                        {n.kind === 'post_reply' && n.data.gameId && <Link to={`/community?hub=${n.data.gameId}&post=${n.data.postId}`} onClick={() => setMenu(null)}>View discussion</Link>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="popwrap">
              <button className="gh-user" onClick={() => setMenu(menu === 'user' ? null : 'user')}>
                <Avatar f={me} size={26} ring={false} />
                <span className="uname">{store.name}</span><Icon name="chevronDown" size={14} />
              </button>
              {menu === 'user' && (
                <div className="popover right">
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/profile') }}>View my profile</button>
                  <button className="pop-item" onClick={() => { setMenu(null); store.friendsOpen = true }}>Friends &amp; Chat</button>
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/downloads') }}>Manage downloads</button>
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/developer') }}>Upload a game</button>
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/settings/account') }}>Account details</button>
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/settings/interface') }}>Settings</button>
                  <button className="pop-item" onClick={() => { setMenu(null); void store.signOut().then(() => nav('/store')) }}>Sign out of account…</button>
                </div>
              )}
            </div>
            <button className="gh-wallet" onClick={() => nav('/settings/account')} title="reSteam Wallet">{fmt(store.wallet)}</button>
          </div>
        ) : store.account === 'out' ? (
          <div className="gh-right">
            <Link to="/developer" className="gh-install"><Icon name="plus" size={13} /> Upload a game</Link>
            <Link className="gh-login" to={`/login?next=${encodeURIComponent(path)}`}>login</Link>
            <span className="gh-sep">|</span>
            <Link className="gh-login" to={`/login?mode=join&next=${encodeURIComponent(path)}`}>join</Link>
          </div>
        ) : null}
      </div>
    </header>
  )
})

export const Footer = () => (
  <footer className="gfooter">
    <div className="gf-inner">
      <div className="gf-brand"><Logo size={30} /> <span>reSteam</span></div>
      <p>reSteam is an independent, non-commercial fan project that recreates the look and behavior of a PC game store for learning. It has no affiliation with, and is not endorsed by, any game store company. All games, studios and artwork here are fictional and generated in your browser.</p>
      <div className="gf-links">
        <Link to="/about">About reSteam</Link>
        <a href="https://github.com/aadsidhu-design/resteam" target="_blank" rel="noreferrer">Source code</a>
        <Link to="/store/browse">Browse all games</Link>
        <Link to="/community">Community</Link>
      </div>
    </div>
  </footer>
)

export const AddGameMenu = observer(() => {
  const nav = useNavigate()
  const [add, setAdd] = useState(false)
  const [dlg, setDlg] = useState<null | 'redeem' | 'custom'>(null)
  const ref = useDismiss(add, () => setAdd(false))
  return (
    <div className="popwrap" ref={ref}>
      <button className="bb-btn" onClick={() => setAdd(!add)}><Icon name="plus" size={20} /> Add a Game</button>
      {add && (
        <div className="popover up">
          <button className="pop-item" onClick={() => { setAdd(false); setDlg('custom') }}>Add a Non-Store Game…</button>
          <button className="pop-item" onClick={() => { setAdd(false); setDlg('redeem') }}>Activate a Product on reSteam…</button>
          <button className="pop-item" onClick={() => { setAdd(false); nav('/store/browse?free=1') }}>Browse free games</button>
          <button className="pop-item" onClick={() => { setAdd(false); nav('/developer') }}>Upload your own game…</button>
        </div>
      )}
      {dlg === 'redeem' && <RedeemModal onClose={() => setDlg(null)} />}
      {dlg === 'custom' && <CustomModal onClose={() => setDlg(null)} />}
    </div>
  )
})

function RedeemModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal title="Activate a Product on reSteam" onClose={onClose}>
      <p>Enter a product code to add a game or wallet funds to your account.</p>
      <form onSubmit={async e => {
        e.preventDefault(); setBusy(true)
        const r = await store.redeem(code); setBusy(false)
        if (r) setErr(r); else { store.toast('Product activated'); onClose() }
      }}>
        <input className="input" autoFocus placeholder="XXXXX-XXXXX-XXXXX" value={code} onChange={e => { setCode(e.target.value); setErr('') }} />
        {err && <div className="err">{err}</div>}
        <div className="modal-actions"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn blue" disabled={!code.trim() || busy}>Activate</button></div>
      </form>
    </Modal>
  )
}

function CustomModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  return (
    <Modal title="Add a Non-Store Game" onClose={onClose}>
      <p>Add any game to your library so it can be launched and tracked here. It is kept on this browser only.</p>
      <form onSubmit={e => { e.preventDefault(); store.addCustomGame(name); onClose() }}>
        <input className="input" autoFocus placeholder="Game name" value={name} maxLength={40} onChange={e => setName(e.target.value)} />
        <div className="modal-actions"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn blue" disabled={!name.trim()}>Add Selected Program</button></div>
      </form>
    </Modal>
  )
}

export const Toasts = observer(() => (
  <div className="toasts" aria-live="polite">
    {store.toasts.map(t => <div key={t.id} className="toast">{t.text}</div>)}
  </div>
))
