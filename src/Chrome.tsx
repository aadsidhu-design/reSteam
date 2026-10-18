import { useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, fmt } from './data'
import { notificationText, store } from './store'
import { Icon } from './icons'
import { Avatar, Logo, Modal, ago, useDismiss } from './ui'
import { LANGUAGES, i18n, t } from './i18n'
import './shell.css'

/** A top-level nav link whose dropdown opens on hover (or keyboard focus), like the real header. */
function NavDrop({ to, label, active, items }: { to: string; label: string; active: boolean; items: [string, string][] }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<number>(0)
  const show = () => { window.clearTimeout(timer.current); setOpen(true) }
  const hide = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 120) }
  return (
    <div className="gh-navitem" onMouseEnter={show} onMouseLeave={hide} onFocus={e => { if (e.target.matches(':focus-visible')) show() }} onBlur={hide}>
      <NavLink to={to} className={active ? 'active' : ''} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(false)}>{label}</NavLink>
      {open && (
        <div className="gh-drop" role="menu">
          {items.map(([text, href]) => <Link key={text + href} to={href} role="menuitem" onClick={() => setOpen(false)}>{text}</Link>)}
        </div>
      )}
    </div>
  )
}

export const Header = observer(() => {
  const nav = useNavigate()
  const path = useLocation().pathname
  const [menu, setMenu] = useState<'bell' | 'user' | 'lang' | null>(null)
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
          <NavDrop to="/store" label={t('nav.store')} active={isStore} items={[[t('st.home'), '/store'], [t('dd.discovery'), '/explore'], [t('mm.newreleases'), '/store/new'], [t('dd.specials'), '/store/specials'], [t('dd.charts'), '/charts'], [t('dd.news'), '/news'], [t('nav.wishlist'), '/wishlist']]} />
          <NavDrop to="/library" label={t('nav.library')} active={isLibrary} items={[[t('st.home'), '/library'], [t('dd.collections'), '/library'], [t('user.downloads'), '/downloads'], [t('dd.interface'), '/settings/interface']]} />
          <NavDrop to="/community" label={t('nav.community')} active={isCommunity} items={[[t('st.home'), '/community'], [t('comm.discussions'), '/community?tab=Discussions'], [t('comm.guides'), '/community?tab=Guides'], [t('comm.reviews'), '/community?tab=Reviews'], [t('dd.news'), '/news'], [t('dd.charts'), '/charts']]} />
          {store.signedIn && <NavDrop to="/profile" label={store.name.toUpperCase()} active={path === '/profile' || path.startsWith('/profile/')} items={[[t('user.profile'), '/profile'], [t('nav.wishlist'), '/wishlist'], [t('ag.upload'), '/developer'], [t('user.account'), '/settings/account'], [t('user.settings'), '/settings/interface']]} />}
          <NavDrop to="/about" label={t('nav.about')} active={isAbout} items={[[t('nav.about'), '/about'], [t('dd.news'), '/news'], [t('ag.upload'), '/developer']]} />
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
            <Link to="/developer" className="gh-install"><Icon name="plus" size={13} /> {t('auth.upload')}</Link>
            <Link to="/wishlist" className="gh-link">{t('nav.wishlist')} ({store.wishlist.length})</Link>
            <Link to="/cart" className="gh-link"><Icon name="cart" size={15} /> {t('nav.cart')} ({store.cart.length})</Link>
            <div className="popwrap">
              <button className="gh-icon" onClick={() => { setMenu(menu === 'bell' ? null : 'bell') }} aria-label="Notifications">
                <Icon name="bell" size={20} />
                {store.unreadCount > 0 && <span className="count">{store.unreadCount}</span>}
              </button>
              {menu === 'bell' && (
                <div className="popover right bell-pop">
                  <div className="pop-title row-between">{t('nt.title')} <button className="link-btn small" onClick={() => void store.markAllRead()}>{t('nt.markall')}</button></div>
                  {store.notifications.length === 0 && <div className="pop-item static read">{t('nt.caught')}</div>}
                  {store.notifications.slice(0, 20).map(n => {
                    const from = n.data.from?.username as string | undefined
                    const pending = n.kind === 'friend_request' && from && store.incoming.some(r => r.username === from)
                    return (
                      <div key={n.id} className={`pop-item static ${n.read ? 'read' : ''}`}>
                        <div>{notificationText(n)}</div>
                        <div className="muted small">{ago(n.at)}</div>
                        {pending && (
                          <div className="req-actions">
                            <button className="btn small green" onClick={() => void store.acceptRequest(from!)}>{t('friends.accept')}</button>
                            <button className="btn small" onClick={() => void store.declineRequest(from!)}>{t('friends.ignore')}</button>
                          </div>
                        )}
                        {n.kind === 'post_reply' && n.data.gameId && <Link to={`/community?hub=${n.data.gameId}&post=${n.data.postId}`} onClick={() => setMenu(null)}>{t('nt.viewdisc')}</Link>}
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
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/profile') }}>{t('user.profile')}</button>
                  <button className="pop-item" onClick={() => { setMenu(null); store.friendsOpen = true }}>Friends &amp; Chat</button>
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/downloads') }}>{t('user.downloads')}</button>
                  {store.admin && <button className="pop-item" onClick={() => { setMenu(null); nav('/admin') }}>Moderation</button>}
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/developer') }}>Upload a game</button>
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/settings/account') }}>{t('user.account')}</button>
                  <button className="pop-item" onClick={() => { setMenu(null); nav('/settings/interface') }}>{t('user.settings')}</button>
                  <button className="pop-item" onClick={() => { setMenu(null); void store.signOut().then(() => nav('/store')) }}>{t('user.signout')}</button>
                </div>
              )}
            </div>
            <div className="popwrap">
              <button className="gh-lang" onClick={() => setMenu(menu === 'lang' ? null : 'lang')} aria-expanded={menu === 'lang'}>{t('lang.label')} <Icon name="chevronDown" size={11} /></button>
              {menu === 'lang' && (
                <div className="popover right lang-pop" role="listbox" aria-label="Language">
                  {LANGUAGES.map(([code, name]) => <button key={code} role="option" aria-selected={i18n.lang === code} className={`pop-item ${i18n.lang === code ? 'sel' : ''}`} onClick={() => { i18n.set(code); setMenu(null) }}>{name}</button>)}
                </div>
              )}
            </div>
            <button className="gh-wallet" onClick={() => nav('/settings/account')} title="reSteam Wallet">{fmt(store.wallet)}</button>
          </div>
        ) : store.account === 'out' ? (
          <div className="gh-right" ref={ref}>
            <Link to="/developer" className="gh-install"><Icon name="plus" size={13} /> {t('auth.upload')}</Link>
            <Link className="gh-login" to={`/login?next=${encodeURIComponent(path)}`}>{t('auth.login')}</Link>
            <span className="gh-sep">|</span>
            <Link className="gh-login" to={`/login?mode=join&next=${encodeURIComponent(path)}`}>{t('auth.join')}</Link>
            <span className="gh-sep">|</span>
            <div className="popwrap">
              <button className="gh-lang" onClick={() => setMenu(menu === 'lang' ? null : 'lang')} aria-expanded={menu === 'lang'}>{t('lang.label')} <Icon name="chevronDown" size={11} /></button>
              {menu === 'lang' && (
                <div className="popover right lang-pop" role="listbox" aria-label="Language">
                  {LANGUAGES.map(([code, name]) => <button key={code} role="option" aria-selected={i18n.lang === code} className={`pop-item ${i18n.lang === code ? 'sel' : ''}`} onClick={() => { i18n.set(code); setMenu(null) }}>{name}</button>)}
                </div>
              )}
            </div>

          </div>
        ) : null}
      </div>
    </header>
  )
})

export const Footer = () => (
  <footer className="gfooter">
    <div className="gf-inner">
      <div className="gf-left">
        <div className="gf-brand"><Logo size={34} /> <span>reSteam</span></div>
        <p>{t('ft.disclaimer')}</p>
      </div>
      <div className="gf-cols">
        <div><h5>RESTEAM</h5><Link to="/about">{t('ft.about')}</Link><Link to="/developer">{t('mm.publish')}</Link><Link to="/store/browse">{t('lib.allgames')}</Link><Link to="/store">{t('ft.gift')}</Link></div>
        <div><h5>{t('nav.community').toUpperCase()}</h5><Link to="/community">{t('nav.community')}</Link><Link to="/community?tab=Discussions">{t('comm.discussions')}</Link><Link to="/community?tab=Guides">{t('comm.guides')}</Link><Link to="/community?tab=Reviews">{t('comm.reviews')}</Link></div>
        <div><h5>{t('ft.legal').toUpperCase()}</h5><Link to="/about">{t('ft.notaff')}</Link><Link to="/about">{t('ft.playmoney')}</Link><Link to="/about">{t('ft.yourdata')}</Link></div>
        <div><h5>{t('ft.more').toUpperCase()}</h5><Link to="/about">About</Link><Link to="/settings/account">{t('mm.myaccount')}</Link><Link to="/login">{t('auth.signin')}</Link><Link to="/login?mode=join">{t('ft.join')}</Link></div>
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
      <button className="bb-btn" onClick={() => setAdd(!add)}><Icon name="plus" size={20} /> {t('lib.addgame')}</button>
      {add && (
        <div className="popover up">
          <button className="pop-item" onClick={() => { setAdd(false); setDlg('custom') }}>{t('ag.nonstore')}</button>
          <button className="pop-item" onClick={() => { setAdd(false); setDlg('redeem') }}>{t('ag.activate')}</button>
          <button className="pop-item" onClick={() => { setAdd(false); nav('/store/browse?free=1') }}>{t('ag.free')}</button>
          <button className="pop-item" onClick={() => { setAdd(false); nav('/developer') }}>{t('ag.upload')}</button>
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
        <div className="modal-actions"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn blue" disabled={!code.trim() || busy}>{t('ag.activatebtn')}</button></div>
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
