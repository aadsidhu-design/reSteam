import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES } from './data'
import { call, store } from './store'
import { Icon } from './icons'
import { Loading } from './ui'
import './player.css'

/** Runs an uploaded web game in a sandboxed frame: scripts allowed, but no cookies, no same-origin access, no top navigation. */
export const Player = observer(() => {
  const { id } = useParams()
  const nav = useNavigate()
  const g = GAMES.find(x => x.id === Number(id))
  const [src, setSrc] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [full, setFull] = useState(false)

  useEffect(() => {
    if (!g?.playable) return
    let live = true
    void call<{ url: string }>('POST', `/games/${g.id}/play-token`).then(r => { if (!live) return; if (r.data) setSrc(r.data.url); else setErr(r.error ?? 'Could not start the game') })
    return () => { live = false }
  }, [g?.id, g?.playable])
  // leaving the page ends the session so playtime and "now playing" stay honest
  useEffect(() => () => { if (store.running === Number(id)) store.stop() }, [id])
  useEffect(() => {
    if (g && store.running === null && src) void store.play(g.id)
  }, [g, src]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!g) return <div className="container"><h1>Game not found</h1></div>
  if (!g.playable) return <div className="container"><h1>{g.title}</h1><p className="muted">This game has no browser build. <Link to={`/library/${g.id}`}>Open it in your library</Link>.</p></div>

  return (
    <div className={`player ${full ? 'full' : ''}`}>
      <div className="player-bar">
        <button className="btn small" onClick={() => nav(`/library/${g.id}`)}><Icon name="back" size={16} /> Library</button>
        <b className="grow">{g.title}</b>
        <span className="muted small">Playing as {store.name}</span>
        <button className="btn small" onClick={() => setFull(!full)}>{full ? 'Exit full window' : 'Full window'}</button>
        <button className="btn small red" onClick={() => { store.stop(); nav(`/library/${g.id}`) }}>Stop</button>
      </div>
      <div className="player-stage">
        {err ? <p className="err">{err}</p> : !src ? <Loading text="Starting game" /> : (
          <iframe title={g.title} src={src} sandbox="allow-scripts allow-pointer-lock allow-forms" allow="fullscreen; gamepad; autoplay" referrerPolicy="no-referrer" />
        )}
      </div>
    </div>
  )
})
