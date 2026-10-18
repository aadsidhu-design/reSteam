import { Navigate, Route, Routes } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { BottomBar, Header, Toasts } from './Chrome'
import { Library } from './Library'
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
          <Route path="/downloads" element={<Downloads />} />
          <Route path="*" element={<div style={{ padding: 40 }}>Coming soon</div>} />
        </Routes>
      </main>
      <BottomBar />
      <FriendsWindow />
      <Toasts />
    </div>
  )
})

export default App
