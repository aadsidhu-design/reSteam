import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES } from './data'
import { api, store, type Person } from './store'
import { Art } from './art'
import { Avatar, Modal, ago, hours } from './ui'
import type { Presence } from './data'

interface ProfileData extends Person {
  relation: 'self' | 'accepted' | 'pending_in' | 'pending_out' | null
  limited: boolean
  presence: { status: Presence; gameId?: number | null; lastSeen?: number | null }
  gamesOwned?: number
  minutes?: number
  level?: number
  friends?: number
  recent?: { gameId: number; playtime: number; lastPlayed: number }[]
}

const presenceText = (p: ProfileData['presence']) =>
  p.status === 'ingame' ? `Currently In-Game — ${GAMES.find(g => g.id === p.gameId)?.title ?? 'a game'}`
  : p.status === 'online' ? 'Currently Online' : p.status === 'away' ? 'Away'
  : p.lastSeen ? `Last Online ${ago(p.lastSeen)}` : 'Offline'

export const ProfilePage = observer(() => {
  const nav = useNavigate()
  const { username: param } = useParams()
  const username = param ?? store.user?.username ?? ''
  const [data, setData] = useState<ProfileData | null | 'missing'>(null)
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  // re-fetch when the relationship changes (friends list / requests refresh over the socket)
  const sig = `${store.friends.length}:${store.incoming.length}:${store.outgoing.length}:${store.name}:${store.privacy}`

  useEffect(() => {
    if (!username) return
    let live = true
    void api<ProfileData>('GET', `/users/${encodeURIComponent(username)}`).then(r => { if (live) setData(r ?? 'missing') })
    return () => { live = false }
  }, [username, sig])

  if (!param && store.account === 'out') return <Navigate to="/login?next=/profile" replace />
  if (param && store.user && param.toLowerCase() === store.user.username.toLowerCase()) return <Navigate to="/profile" replace />
  if (data === null) return <div className="profile"><div className="pf-wrap muted">Loading…</div></div>
  if (data === 'missing') return <div className="profile"><div className="pf-wrap"><h1>Profile not found</h1><p className="muted">No account with that name was found, or you cannot view it.</p><Link to="/community" className="btn">Back to Community</Link></div></div>

  const self = data.relation === 'self'
  const shown = self ? { name: store.name, status: store.status } : { name: data.name, status: data.presence.status }
  const recent = (data.recent ?? []).map(r => ({ ...r, game: GAMES.find(g => g.id === r.gameId) })).filter(r => r.game)
  const fav = self ? store.ownedGames.find(g => store.favorites.includes(g.id)) : undefined
  const unfriend = async () => { if (confirm(`Remove ${data.name} from your friends?`)) { await store.removeFriend(data.username) } }

  return (
    <div className="profile">
      <div className="pf-wrap">
        <div className="pf-head">
          <div className="pf-avatar"><Avatar f={shown} size={160} /></div>
          <div className="grow">
            <h1>{shown.name}</h1>
            <div className="muted small">@{data.username}</div>
            <div className="muted">{self ? (store.running !== null ? `Currently In-Game — ${GAMES.find(g => g.id === store.running)?.title}` : store.status === 'offline' ? 'Invisible' : store.status === 'away' ? 'Away' : 'Currently Online') : presenceText(data.presence)}</div>
            <div className="pf-btns">
              {self && <><button className="btn" onClick={() => { setName(store.name); setMsg(''); setEdit(true) }}>Edit Profile</button><Link to="/settings/account" className="btn">Account</Link></>}
              {data.relation === 'accepted' && <><button className="btn blue" onClick={() => void store.openChat(data.username)}>Chat</button><button className="btn" onClick={() => void unfriend()}>Remove friend</button></>}
              {data.relation === 'pending_out' && <button className="btn" disabled>Invite sent</button>}
              {data.relation === 'pending_in' && <button className="btn green" onClick={() => void store.acceptRequest(data.username)}>Accept friend request</button>}
              {data.relation === null && <button className="btn blue" onClick={async () => { const e = await store.sendRequest(data.username); store.toast(e ?? `Friend request sent to ${data.name}`) }}>Add friend</button>}
              {!self && data.relation !== 'accepted' && <button className="btn" onClick={() => { if (confirm(`Block ${data.name}?`)) void store.block(data.username).then(() => nav('/community')) }}>Block</button>}
            </div>
          </div>
          {!data.limited && <div className="pf-level"><div className="lvl">{data.level ?? 1}</div><div className="muted small">Level</div></div>}
        </div>
        {data.limited ? (
          <p className="muted pf-private">This profile is {store.signedIn ? 'private' : 'not visible'}. Only their name is shown.</p>
        ) : (
          <div className="pf-cols">
            <div>
              <h2>Recent Activity</h2>
              <div className="muted small pf-hrs">{hours(data.minutes ?? 0)} on record</div>
              {recent.length === 0 && <p className="muted">{self ? 'Play a game and it will show up here.' : 'No recent games.'}</p>}
              {recent.map(r => (
                <Link key={r.gameId} to={self && store.owned.includes(r.gameId) ? `/library/${r.gameId}` : `/store/${r.gameId}`} className="pf-game">
                  <div className="pf-art"><Art game={r.game!} kind="header" /></div>
                  <div><div className="pf-gname">{r.game!.title}</div><div className="muted small">{hours(r.playtime)} on record · last played {ago(r.lastPlayed).toLowerCase()}</div></div>
                </Link>
              ))}
              {fav && (<><h2 className="mt">Favorite Game</h2><Link to={`/library/${fav.id}`} className="pf-game"><div className="pf-art"><Art game={fav} kind="header" /></div><div className="pf-gname">{fav.title}</div></Link></>)}
            </div>
            <aside>
              <div className="pf-stats">
                {([['Games', data.gamesOwned ?? 0], ['Friends', data.friends ?? 0], ['Hours played', Math.round((data.minutes ?? 0) / 60)]] as const).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
                {self && <div><span>Wishlist</span><b>{store.wishlist.length}</b></div>}
              </div>
            </aside>
          </div>
        )}
      </div>
      {edit && (
        <Modal title="Edit Profile" onClose={() => setEdit(false)} width={420}>
          <form onSubmit={async e => { e.preventDefault(); const err = await store.setName(name); setMsg(err ?? 'Saved'); if (!err) setTimeout(() => setEdit(false), 400) }}>
            <label className="small muted">Profile name</label>
            <input className="input" autoFocus value={name} maxLength={20} onChange={e => { setName(e.target.value); setMsg('') }} />
            {msg && <div className={`small ${msg === 'Saved' ? 'pos' : 'err'}`}>{msg}</div>}
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setEdit(false)}>Cancel</button><button className="btn blue" disabled={!name.trim() || name.trim() === store.name}>Save</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
})
