import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, fmt, slug } from './data'
import { store } from './store'
import { Icon } from './icons'
import { Avatar, Modal, nameHue, useDismiss } from './ui'

export const Header = observer(() => {
  const nav = useNavigate()
  const loc = useLocation()
  const path = loc.pathname
  const [menu, setMenu] = useState<'news' | 'bell' | 'user' | null>(null)
  const [openNews, setOpenNews] = useState<string | null>(null)
  const [signOutAsk, setSignOutAsk] = useState(false)
  const ref = useDismiss(menu !== null, () => setMenu(null))
  const isStore = path.startsWith('/store') || path === '/cart' || path === '/wishlist'
  const isCommunity = path.startsWith('/community')
  const isLibrary = path.startsWith('/library') || path.startsWith('/downloads')
  const isProfile = path.startsWith('/profile')
  const showUrl = isStore || isCommunity
  const me = { name: store.name, hue: nameHue(store.name), status: store.status }

  let url = 'https://store.resteam.app/'
  if (isCommunity) url = 'https://community.resteam.app/'
  else if (path.startsWith('/store/browse')) url = 'https://store.resteam.app/search/'
  else if (path.startsWith('/store/')) {
    const g = GAMES.find(x => x.id === Number(path.split('/')[2]))
    if (g) url = `https://store.resteam.app/app/${g.id}/${slug(g.title)}/`
  } else if (path === '/cart') url = 'https://store.resteam.app/cart/'
  else if (path === '/wishlist') url = 'https://store.resteam.app/wishlist/'

  return (
    <header className="titlebar">
      <div className="winctl" aria-hidden><i className="r" /><i className="y" /><i className="g" /></div>
      <div className="navrow">
        <div className="historybtns">
          <button className="hist" onClick={() => nav(-1)} aria-label="Back"><Icon name="back" size={22} /></button>
          <button className="hist" onClick={() => nav(1)} aria-label="Forward"><Icon name="forward" size={22} /></button>
        </div>
        <nav className="mainnav">
          <NavLink to="/store" className={isStore ? 'active' : ''}>STORE</NavLink>
          <NavLink to="/library" className={isLibrary ? 'active' : ''}>LIBRARY</NavLink>
          <NavLink to="/community" className={isCommunity ? 'active' : ''}>COMMUNITY</NavLink>
          <NavLink to="/profile" className={isProfile ? 'active' : ''}>{store.name.toUpperCase()}</NavLink>
        </nav>
        <div className="grow" />
        <div className="navright" ref={ref}>
          <div className="popwrap">
            <button className="pill blue" onClick={() => setMenu(menu === 'news' ? null : 'news')} aria-label="News"><Icon name="megaphone" size={18} /></button>
            {menu === 'news' && (
              <div className="popover right news-pop">
                <div className="pop-title">What's New</div>
                {store.news.map(n => (
                  <button key={n.id} className="pop-item stack" onClick={() => setOpenNews(openNews === n.id ? null : n.id)}>
                    <b>{n.title}</b><span className="muted small">{n.when}</span>
                    {openNews === n.id && <span className="small body">{n.body}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="popwrap">
            <button className="pill green" onClick={() => { setMenu(menu === 'bell' ? null : 'bell') }} aria-label="Notifications">
              <Icon name="bell" size={18} />
              {store.unreadCount > 0 && <span className="count">{store.unreadCount}</span>}
            </button>
            {menu === 'bell' && (
              <div className="popover right">
                <div className="pop-title row-between">Notifications <button className="link-btn small" onClick={() => store.markAllRead()}>Mark all read</button></div>
                {store.notifications.map(n => (
                  <div key={n.id} className={`pop-item static ${store.readNotifs.includes(n.id) ? 'read' : ''}`}>{n.text}</div>
                ))}
              </div>
            )}
          </div>
          <div className="userchip">
          <div className="popwrap">
            <button className="userbtn" onClick={() => setMenu(menu === 'user' ? null : 'user')}>
              <Avatar f={me} size={24} ring={false} />
              <span className="uname">{store.name}</span><Icon name="chevronDown" size={14} />
            </button>
            {menu === 'user' && (
              <div className="popover right">
                <button className="pop-item" onClick={() => { setMenu(null); nav('/profile') }}>View my profile</button>
                <button className="pop-item" onClick={() => { setMenu(null); store.friendsOpen = true }}>Friends</button>
                <button className="pop-item" onClick={() => { setMenu(null); nav('/settings/account') }}>Account details</button>
                <button className="pop-item" onClick={() => { setMenu(null); nav('/settings/interface') }}>Settings</button>
                <button className="pop-item" onClick={() => { setMenu(null); setSignOutAsk(true) }}>Sign out of account…</button>
              </div>
            )}
          </div>
          <button className="walletchip" onClick={() => nav('/settings/account')}>{fmt(store.wallet)}</button>
          </div>
        </div>
      </div>
      {showUrl && (
        <div className="urlrow">
          <button className="hist small" onClick={() => location.reload()} aria-label="Reload"><Icon name="refresh" size={18} /></button>
          <Icon name="lock" size={15} className="urllock" />
          <span className="urltext">{url}</span>
        </div>
      )}
      {signOutAsk && (
        <Modal title="Sign out of reSteam?" onClose={() => setSignOutAsk(false)} width={420}>
          <p>This starts a fresh anonymous account on this browser. Your current library and wallet will no longer be reachable from here.</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setSignOutAsk(false)}>Cancel</button>
            <button className="btn red" onClick={() => store.signOut()}>Sign out</button>
          </div>
        </Modal>
      )}
    </header>
  )
})

export const BottomBar = observer(() => {
  const nav = useNavigate()
  const [add, setAdd] = useState(false)
  const [dlg, setDlg] = useState<null | 'redeem' | 'custom'>(null)
  const ref = useDismiss(add, () => setAdd(false))
  const active = store.activeDownload ?? store.queue[0]
  const game = active ? GAMES.find(g => g.id === active.id) : undefined

  return (
    <footer className="bottombar">
      <div className="bb-left popwrap" ref={ref}>
        <button className="bb-btn" onClick={() => setAdd(!add)}><Icon name="plus" size={20} /> Add a Game</button>
        {add && (
          <div className="popover up">
            <button className="pop-item" onClick={() => { setAdd(false); setDlg('custom') }}>Add a Non-Store Game…</button>
            <button className="pop-item" onClick={() => { setAdd(false); setDlg('redeem') }}>Activate a Product on reSteam…</button>
            <button className="pop-item" onClick={() => { setAdd(false); nav('/store/browse?free=1') }}>Browse free games</button>
          </div>
        )}
      </div>
      <button className="bb-btn bb-center" onClick={() => nav('/downloads')}>
        <Icon name="download" size={20} />
        {active && game ? (
          <span className="bb-dl">
            <span className="bb-dl-title">{store.activeDownload ? 'Downloading' : 'Paused'}: {game.title}</span>
            <span className="bb-dl-bar"><span style={{ width: `${active.progress}%` }} /></span>
          </span>
        ) : 'Manage Downloads'}
      </button>
      <button className="bb-btn bb-right" onClick={() => (store.friendsOpen = !store.friendsOpen)}>
        Friends &amp; Chat <Icon name="group" size={20} />
      </button>
      {dlg === 'redeem' && <RedeemModal onClose={() => setDlg(null)} />}
      {dlg === 'custom' && <CustomModal onClose={() => setDlg(null)} />}
    </footer>
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

