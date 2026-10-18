import { Navigate, Route, Routes } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { BottomBar, Header, Toasts } from './Chrome'
import { Library } from './Library'
import { Browse, Cart, StoreHome, StoreLayout, Wishlist } from './StorePages'
import { StoreGame } from './StoreGame'
import { Community } from './Community'
import { Profile, SettingsPage } from './Settings'
import { GAMES } from './data'
import { store } from './store'
import { useLocation } from 'react-router-dom'
import { Downloads } from './Downloads'
import { FriendsWindow } from './Friends'

const App = observer(() => {
  const loc = useLocation()
  const lib = loc.pathname.startsWith('/library')
  return (
    <div className="window">
      <Header />
      <main className={`view ${lib ? 'lib' : ''}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:id" element={<Library />} />
          <Route element={<StoreLayout />}>
            <Route path="/store" element={<StoreHome />} />
            <Route path="/store/browse" element={<Browse />} />
            <Route path="/store/:id" element={<StoreGame />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/wishlist" element={<Wishlist />} />
          </Route>
          <Route path="/community" element={<Community />} />
          <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="*" element={<div style={{ padding: 40 }}>Coming soon</div>} />
        </Routes>
      </main>
      {store.running !== null && store.settings.fpsCounter && store.settings.overlay && <div className="fps-overlay">FPS {58 + (store.running % 5)} · {GAMES.find(g => g.id === store.running)?.title ?? 'Game'}</div>}
      <BottomBar />
      <FriendsWindow />
      <Toasts />
    </div>
  )
})

export default App
