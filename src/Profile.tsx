import { useEffect, useState } from 'react'
import { t } from './i18n'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES } from './data'
import { api, store, type Person } from './store'
import { Art } from './art'
import { Avatar, Loading, Modal, ago, hours } from './ui'
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
  if (data === null) return <div className="profile"><div className="pf-wrap"><Loading /></div></div>
  if (data === 'missing') return <div className="profile"><div className="pf-wrap"><h1>{t('pf.notfound')}</h1><p className="muted">{t('pf.notfounddesc')}</p><Link to="/community" className="btn">{t('pf.back')}</Link></div></div>

  const self = data.relation === 'self'
  const shown = self ? { name: store.name, status: store.status } : { name: data.name, status: data.presence.status }
  const recent = (data.recent ?? []).map(r => ({ ...r, game: GAMES.find(g => g.id === r.gameId) })).filter(r => r.game)
  const fav = self ? store.ownedGames.find(g => store.favorites.includes(g.id)) : undefined
  const unfriend = async () => { if (confirm(`Remove ${data.name} from your friends?`)) { await store.removeFriend(data.username) } }

  return (
    <div className="profile">
      <div className="pf-wrap">
        <div className="pf-head">
          <div className="pf-avatar"><Avatar f={shown} size={164} /></div>
          <div className="pf-who">
            <h1>{shown.name}</h1>
            <div className="muted small">@{data.username}</div>
            <div className="pf-btns">
              {self && <><button className="btn" onClick={() => { setName(store.name); setMsg(''); setEdit(true) }}>{t('pf.edit')}</button><Link to="/settings/account" className="btn">{t('set.account')}</Link></>}
              {data.relation === 'accepted' && <><button className="btn blue" onClick={() => void store.openChat(data.username)}>{t('pf.chat')}</button><button className="btn" onClick={() => void unfriend()}>{t('pf.remove')}</button></>}
              {data.relation === 'pending_out' && <button className="btn" disabled>{t('pf.sent')}</button>}
              {data.relation === 'pending_in' && <button className="btn green" onClick={() => void store.acceptRequest(data.username)}>{t('pf.accept')}</button>}
              {data.relation === null && <button className="btn blue" onClick={async () => { const e = await store.sendRequest(data.username); store.toast(e ?? `Friend request sent to ${data.name}`) }}>{t('pf.add')}</button>}
              {!self && data.relation !== 'accepted' && <button className="btn" onClick={() => { if (confirm(`Block ${data.name}?`)) void store.block(data.username).then(() => nav('/community')) }}>{t('pf.block')}</button>}
            </div>
          </div>
          {!data.limited && <div className="pf-level"><span className="lvl-t">{t('pf.level')}</span><span className="lvl">{data.level ?? 1}</span></div>}
        </div>
        {data.limited ? (
          <p className="muted pf-private">This profile is {store.signedIn ? 'private' : 'not visible'}. Only their name is shown.</p>
        ) : (
          <div className="pf-cols">
            <div className="pf-panel">
              <div className="pf-bar">{t('pf.recent')}</div>
              <div className="pf-inner">
                <div className="muted small pf-hrs">{hours(data.minutes ?? 0)} on record</div>
                {recent.length === 0 && <p className="muted">{self ? 'Play a game and it will show up here.' : 'No recent games.'}</p>}
                {recent.map(r => {
                  const g = r.game!
                  const got = Math.min(g.achievements, Math.floor(r.playtime / 3))
                  return (
                    <div key={r.gameId} className="pf-row">
                      <Link to={self && store.owned.includes(r.gameId) ? `/library/${r.gameId}` : `/store/${r.gameId}`} className="pf-game">
                        <div className="pf-art"><Art game={g} kind="header" /></div>
                        <div className="pf-info"><div className="pf-gname">{g.title}</div><div className="muted small pf-meta">{hours(r.playtime)} on record<br />last played {ago(r.lastPlayed).toLowerCase()}</div></div>
                      </Link>
                      {g.achievements > 0 && <div className="pf-ach"><span className="small">{got} / {g.achievements} Achievements</span><div className="pf-achbar"><span style={{ width: `${(got / g.achievements) * 100}%` }} /></div></div>}
                    </div>
                  )
                })}
                {fav && (<><div className="pf-sub">{t('pf.fav')}</div><Link to={`/library/${fav.id}`} className="pf-game"><div className="pf-art"><Art game={fav} kind="header" /></div><div className="pf-gname">{fav.title}</div></Link></>)}
              </div>
            </div>
            <aside className="pf-side">
              <div className="pf-status">
                <div className="pf-st">{self ? (store.running !== null ? 'Currently In-Game' : store.status === 'offline' ? 'Invisible' : store.status === 'away' ? 'Away' : 'Currently Online') : presenceText(data.presence)}</div>
                {self && store.running !== null && <div className="muted">{GAMES.find(g => g.id === store.running)?.title}</div>}
              </div>
              <div className="pf-links">
                <div><span>Games</span><b>{data.gamesOwned ?? 0}</b></div>
                <div><span>{t('pf.friendsn')}</span><b>{data.friends ?? 0}</b></div>
                <div><span>{t('pf.hours')}</span><b>{Math.round((data.minutes ?? 0) / 60)}</b></div>
                {self && <Link to="/wishlist"><span>{t('pf.wishlist')}</span><b>{store.wishlist.length}</b></Link>}
                {self && <Link to="/developer"><span>{t('pf.published')}</span></Link>}
              </div>
            </aside>
          </div>
        )}
      </div>
      {edit && (
        <Modal title={t('pf.edit')} onClose={() => setEdit(false)} width={420}>
          <form onSubmit={async e => { e.preventDefault(); const err = await store.setName(name); setMsg(err ?? 'Saved'); if (!err) setTimeout(() => setEdit(false), 400) }}>
            <label className="small muted">{t('pf.name')}</label>
            <input className="input" autoFocus value={name} maxLength={20} onChange={e => { setName(e.target.value); setMsg('') }} />
            {msg && <div className={`small ${msg === 'Saved' ? 'pos' : 'err'}`}>{msg}</div>}
            <div className="modal-actions"><button type="button" className="btn" onClick={() => setEdit(false)}>{t('pf.cancel')}</button><button className="btn blue" disabled={!name.trim() || name.trim() === store.name}>{t('pf.save')}</button></div>
          </form>
        </Modal>
      )}
    </div>
  )
})
