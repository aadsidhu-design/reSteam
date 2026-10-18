import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { Footer, Header, Toasts } from './Chrome'
import { Library } from './Library'
import { Browse, Cart, StoreHome, StoreLayout, Wishlist } from './StorePages'
import { StoreGame } from './StoreGame'
import { Community } from './Community'
import { SettingsPage } from './Settings'
import { ProfilePage } from './Profile'
import { LoginPage, QrApprove, RequireAuth } from './Auth'
import { About } from './About'
import { Player } from './Player'
import { Explore } from './Explore'
import { Developer } from './Developer'
import { GAMES } from './data'
import { store } from './store'
import { Downloads } from './Downloads'
import { Loading } from './ui'
import { FriendsDock, FriendsWindow } from './Friends'

const App = observer(() => {
  const loc = useLocation()
  const lib = loc.pathname.startsWith('/library')
  const guard = (el: React.ReactNode) => <RequireAuth>{el}</RequireAuth>
  return (
    <div className="window">
      <Header />
      <main className={`view ${lib ? 'lib' : ''}`}>
        <div className="page">
          {store.account === 'loading' || !store.catalogReady ? <Loading /> : <Routes>
            <Route path="/" element={<Navigate to="/store" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/qr/:id" element={<QrApprove />} />
            <Route path="/about" element={<About />} />
            <Route path="/explore" element={guard(<Explore />)} />
            <Route path="/play/:id" element={guard(<Player />)} />
            <Route path="/developer" element={guard(<Developer />)} />
            <Route path="/library" element={guard(<Library />)} />
            <Route path="/library/:id" element={guard(<Library />)} />
            <Route element={<StoreLayout />}>
              <Route path="/store" element={<StoreHome />} />
              <Route path="/store/browse" element={<Browse />} />
              <Route path="/store/:id" element={<StoreGame />} />
              <Route path="/cart" element={guard(<Cart />)} />
              <Route path="/wishlist" element={guard(<Wishlist />)} />
            </Route>
            <Route path="/community" element={<Community />} />
            <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
            <Route path="/settings/:section" element={guard(<SettingsPage />)} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:username" element={guard(<ProfilePage />)} />
            <Route path="/downloads" element={guard(<Downloads />)} />
            <Route path="*" element={<div className="container"><h1>Page not found</h1><p className="muted">That page does not exist.</p></div>} />
          </Routes>}
        </div>
        {!lib && !loc.pathname.startsWith('/play/') && <Footer />}
      </main>
      {store.running !== null && store.settings.fpsCounter && store.settings.overlay && <div className="fps-overlay">FPS {58 + (store.running % 5)} · {GAMES.find(g => g.id === store.running)?.title ?? 'Game'}</div>}
      <FriendsWindow />
      <FriendsDock />
      <Toasts />
    </div>
  )
})

export default App
