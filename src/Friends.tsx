import { useEffect, useRef, useState } from 'react'
import { t } from './i18n'
import { useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES } from './data'
import { store, type Friend, type Person } from './store'
import { Icon } from './icons'
import { Avatar, Modal, useDismiss } from './ui'
import { ago } from './ui'
import './friends.css'

const gameName = (id?: number | null) => GAMES.find(g => g.id === id)?.title
const statusLine = (f: Friend) => {
  const p = f.presence
  return p.status === 'ingame' ? `Playing ${gameName(p.gameId) ?? 'a game'}` : p.status === 'online' ? 'Online' : p.status === 'away' ? 'Away'
    : p.lastSeen ? `Last online ${ago(p.lastSeen).toLowerCase()}` : 'Offline'
}

const Row = observer(({ f, onMenu, onOpen }: { f: Friend; onMenu: (e: React.MouseEvent, f: Friend) => void; onOpen: () => void }) => (
  <button className="frow" draggable onDragStart={e => { e.dataTransfer.setData('text/friend', f.username); e.dataTransfer.effectAllowed = 'copy' }} onClick={onOpen} onContextMenu={e => onMenu(e, f)}>
    <Avatar f={{ name: f.name, status: f.presence.status }} size={46} />
    <div className="finfo">
      <div className={`fname st-${f.presence.status}`}>{f.name}</div>
      <div className="fstatus">{statusLine(f)}</div>
    </div>
    {f.unread > 0 && <span className="fbadge">{f.unread}</span>}
  </button>
))

/** Bottom-right "Friends & Chat" bar, like the web store. */
export const FriendsDock = observer(() => {
  if (!store.signedIn) return null
  const n = store.onlineFriends.length
  return (
    <button className="fdock" onClick={() => (store.friendsOpen = !store.friendsOpen)} aria-expanded={store.friendsOpen}>
      {t('friends.title')}
      <span className="online-n">{n} {t('friends.online')}</span>
      {(store.unreadChats + store.incoming.length) > 0 && <span className="badge">{store.unreadChats + store.incoming.length}</span>}
    </button>
  )
})

const AddFriend = observer(() => {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => {
    setMsg(null)
    if (q.trim().length < 2) { setResults([]); return }
    let live = true
    const t = setTimeout(() => { void store.search(q.trim()).then(r => { if (live) setResults(r) }) }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [q])
  const add = async (username: string) => {
    const err = await store.sendRequest(username)
    setMsg(err ? { ok: false, text: err } : { ok: true, text: `Friend request sent to ${username}` })
  }
  return (
    <div className="fextra">
      <form onSubmit={e => { e.preventDefault(); if (q.trim()) void add(q.trim()) }}>
        <input className="input" autoFocus placeholder="Search by account name" value={q} onChange={e => setQ(e.target.value)} />
      </form>
      {msg && <div className={`small ${msg.ok ? 'pos' : 'err'}`}>{msg.text}</div>}
      {results.map(u => {
        const isFriend = !!store.friend(u.username)
        const sent = store.outgoing.some(r => r.username.toLowerCase() === u.username.toLowerCase())
        return (
          <div key={u.username} className="sres">
            <Avatar f={{ name: u.name }} size={32} ring={false} />
            <div className="grow"><div>{u.name}</div><div className="small muted">@{u.username}</div></div>
            {isFriend ? <span className="small muted">Friends</span> : sent ? <span className="small muted">Invite sent</span> : <button className="btn small blue" onClick={() => void add(u.username)}>Add friend</button>}
          </div>
        )
      })}
      {q.trim().length >= 2 && results.length === 0 && <div className="small muted">No accounts match "{q.trim()}".</div>}
    </div>
  )
})

export const FriendsWindow = observer(() => {
  const nav = useNavigate()
  const [statusMenu, setStatusMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [sortAsc, setSortAsc] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [ctx, setCtx] = useState<{ x: number; y: number; f: Friend } | null>(null)
  const [newGroup, setNewGroup] = useState(false)
  const [dropHot, setDropHot] = useState(false)
  const dropFav = (e: React.DragEvent) => { e.preventDefault(); setDropHot(false); const id = e.dataTransfer.getData('text/friend'); if (id && !store.favFriends.includes(id)) store.toggleFavFriend(id) }
  const statusRef = useDismiss(statusMenu, () => setStatusMenu(false))
  const ctxRef = useDismiss(!!ctx, () => setCtx(null))
  const me = { name: store.name, status: store.status === 'offline' ? 'offline' : store.running !== null ? 'ingame' : store.status }

  if (!store.signedIn) return null
  if (!store.friendsOpen) return <ChatWindows />

  const q = search.trim().toLowerCase()
  const byName = (a: Friend, b: Friend) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name) * -1)
  const list = store.friends.filter(f => !q || f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q)).sort(byName)
  const groups: [string, Friend[]][] = [
    ['In-Game', list.filter(f => f.presence.status === 'ingame')],
    ['Online', list.filter(f => f.presence.status === 'online' || f.presence.status === 'away')],
    ['Offline', list.filter(f => f.presence.status === 'offline')],
  ]
  const openMenu = (e: React.MouseEvent, f: Friend) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, f }) }
  const favs = store.favFriends.map(u => store.friend(u)).filter((f): f is Friend => !!f)

  return (
    <>
      <ChatWindows />
      <div className="fwin" role="dialog" aria-label="Friends and chat">
        <div className="fhead">
          <div className="fme">
            <Avatar f={me} size={52} />
            <div className="popwrap" ref={statusRef}>
              <button className="fme-name" onClick={() => setStatusMenu(!statusMenu)}>{store.name} <Icon name="chevronDown" size={16} /></button>
              <div className="fme-status">{store.running !== null ? `Playing ${gameName(store.running) ?? 'a game'}` : store.status === 'offline' ? 'Invisible' : store.status === 'away' ? 'Away' : 'Online'}</div>
              {statusMenu && (
                <div className="popover" style={{ left: 0, minWidth: 180 }}>
                  {(['online', 'away', 'offline'] as const).map(s => (
                    <button key={s} className="pop-item" onClick={() => { void store.setStatus(s); setStatusMenu(false) }}>{s === 'offline' ? 'Invisible' : s[0].toUpperCase() + s.slice(1)}</button>
                  ))}
                </div>
              )}
            </div>
            <span className="grow" />
            <button className="icon-btn" onClick={() => (store.friendsOpen = false)} aria-label="Close friends list"><Icon name="close" size={20} /></button>
          </div>
        </div>

        {favs.length > 0 ? (
          <div className={`ffav ${dropHot ? 'hot' : ''}`} onDragOver={e => { e.preventDefault(); setDropHot(true) }} onDragLeave={() => setDropHot(false)} onDrop={dropFav}>
            {favs.map(f => (
              <button key={f.username} className="fav-chip" onClick={() => void store.openChat(f.username)} onContextMenu={e => openMenu(e, f)} title={`${f.name} — ${statusLine(f)}`}><Avatar f={{ name: f.name, status: f.presence.status }} size={40} /><span>{f.name}</span></button>
            ))}
          </div>
        ) : !store.hints.drag && store.friends.length > 0 && (
          <div className={`fhint ${dropHot ? 'hot' : ''}`} onDragOver={e => { e.preventDefault(); setDropHot(true) }} onDragLeave={() => setDropHot(false)} onDrop={dropFav}><span>Drag Friends &amp; Chats here for easy access</span><button className="gotit" onClick={() => (store.hints.drag = true)}>GOT IT!</button></div>
        )}

        <div className="fbar">
          <span>{t('friends.friends')}</span><span className="grow" />
          <button className="icon-btn" onClick={() => { setSearching(!searching); setSearch('') }} aria-label="Search friends"><Icon name="search" size={22} /></button>
          <button className="icon-btn" onClick={() => setAdding(!adding)} aria-label={t('friends.add')}><Icon name="personAdd" size={24} /></button>
        </div>
        {searching && <div className="fextra"><input className="input" autoFocus placeholder="Search friends" value={search} onChange={e => setSearch(e.target.value)} /></div>}
        {adding && <AddFriend />}

        <div className="flist">
          {store.incoming.length > 0 && (
            <div>
              <div className="ghead"><span className="gtoggle">{t('friends.requests')} <span className="muted">({store.incoming.length})</span></span></div>
              {store.incoming.map(r => (
                <div key={r.username} className="frow static">
                  <Avatar f={{ name: r.name }} size={46} ring={false} />
                  <div className="finfo"><div className="fname">{r.name}</div><div className="fstatus">wants to be friends</div></div>
                  <button className="btn small green" onClick={() => void store.acceptRequest(r.username)}>{t('friends.accept')}</button>
                  <button className="btn small" onClick={() => void store.declineRequest(r.username)}>{t('friends.ignore')}</button>
                </div>
              ))}
            </div>
          )}
          {groups.map(([name, items], gi) => items.length > 0 && (
            <div key={name}>
              <div className="ghead">
                <button className="gtoggle" onClick={() => setCollapsed({ ...collapsed, [name]: !collapsed[name] })}>
                  <Icon name={collapsed[name] ? 'chevronRight' : 'chevronDown'} size={18} /> {name} <span className="muted">({items.length})</span>
                </button>
                {gi === groups.findIndex(g => g[1].length > 0) && <button className="icon-btn az" onClick={() => setSortAsc(!sortAsc)} aria-label="Sort A to Z" title="Sort A to Z">A↓Z</button>}
              </div>
              {!collapsed[name] && items.map(f => <Row key={f.username} f={f} onMenu={openMenu} onOpen={() => void store.openChat(f.username)} />)}
            </div>
          ))}
          {store.outgoing.length > 0 && (
            <div>
              <div className="ghead"><span className="gtoggle">Pending <span className="muted">({store.outgoing.length})</span></span></div>
              {store.outgoing.map(r => (
                <div key={r.username} className="frow static dim">
                  <Avatar f={{ name: r.name }} size={46} ring={false} />
                  <div className="finfo"><div className="fname">{r.name}</div><div className="fstatus">Invite sent</div></div>
                  <button className="btn small" onClick={() => void store.declineRequest(r.username)}>Cancel</button>
                </div>
              ))}
            </div>
          )}
          {store.friends.length === 0 && store.incoming.length === 0 && store.outgoing.length === 0 && (
            <p className="muted fempty">No friends yet. Use <b>Add a friend</b> (the + person icon) to find someone by account name.</p>
          )}
          {store.friends.length > 0 && list.length === 0 && <p className="muted fempty">No friends match.</p>}
        </div>

        <div className="gbar">
          <button className="gtoggle" onClick={() => setCollapsed({ ...collapsed, groups: !collapsed.groups })}><Icon name={collapsed.groups ? 'chevronRight' : 'chevronDown'} size={18} /> {t('friends.groups')}</button>
          <span className="grow" />
          <button className="icon-btn round" onClick={() => setNewGroup(true)} aria-label="Start a group chat"><Icon name="plus" size={22} /></button>
        </div>
        {!collapsed.groups && (
          <div className="gbody">
            {store.groups.length === 0 ? (
              <p className="muted">Any group chats you are part of will be listed here.<br />You can start a chat with friends or join a group chat.</p>
            ) : store.groups.map(g => (
              <button key={g.id} className="frow" onClick={() => void store.openChat(`g:${g.id}`)}>
                <div className="gicon"><Icon name="group" size={24} /></div>
                <div className="finfo"><div className="fname">{g.name}</div><div className="fstatus">{g.members} member{g.members === 1 ? '' : 's'}</div></div>
              </button>
            ))}
          </div>
        )}
      </div>

      {ctx && (
        <div className="popover" ref={ctxRef} style={{ position: 'fixed', left: Math.min(ctx.x, window.innerWidth - 250), top: Math.min(ctx.y, window.innerHeight - 280), minWidth: 230, zIndex: 90 }}>
          <button className="pop-item" onClick={() => { void store.openChat(ctx.f.username); setCtx(null) }}>Send Message</button>
          <button className="pop-item" onClick={() => { store.toggleFavFriend(ctx.f.username); setCtx(null) }}>{store.favFriends.includes(ctx.f.username) ? 'Remove from Favorites' : 'Add to Favorites'}</button>
          <button className="pop-item" onClick={() => { nav(`/profile/${ctx.f.username}`); setCtx(null) }}>View Profile</button>
          {ctx.f.presence.gameId && <button className="pop-item" onClick={() => { nav(`/store/${ctx.f.presence.gameId}`); setCtx(null) }}>Store Page</button>}
          {ctx.f.presence.gameId && store.owned.includes(ctx.f.presence.gameId) && <button className="pop-item" onClick={() => { nav(`/library/${ctx.f.presence.gameId}`); setCtx(null) }}>View Game in Library</button>}
          <button className="pop-item" onClick={() => { const f = ctx.f; setCtx(null); if (confirm(`Remove ${f.name} from your friends?`)) void store.removeFriend(f.username) }}>Remove Friend</button>
          <button className="pop-item" onClick={() => { const f = ctx.f; setCtx(null); if (confirm(`Block ${f.name}? They will be removed from your friends and cannot message you.`)) void store.block(f.username) }}>Block All Communication</button>
        </div>
      )}
      {newGroup && <GroupModal onClose={() => setNewGroup(false)} />}
    </>
  )
})

function GroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [err, setErr] = useState('')
  return (
    <Modal title="Start a group chat" onClose={onClose}>
      <input className="input" autoFocus placeholder="Group name" value={name} maxLength={30} onChange={e => setName(e.target.value)} />
      <div className="pick-list">
        {store.friends.length === 0 && <div className="muted small">Add some friends first.</div>}
        {store.friends.map(f => (
          <label key={f.username} className="pick"><input type="checkbox" checked={picked.includes(f.username)} onChange={() => setPicked(picked.includes(f.username) ? picked.filter(x => x !== f.username) : [...picked, f.username])} /> <Avatar f={{ name: f.name }} size={26} ring={false} /> {f.name}</label>
        ))}
      </div>
      {err && <div className="err">{err}</div>}
      <div className="modal-actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn blue" disabled={picked.length === 0} onClick={async () => { const e = await store.createGroup(name, picked); if (e) setErr(e); else onClose() }}>Create</button></div>
    </Modal>
  )
}

const ChatWindow = observer(({ id }: { id: string }) => {
  const nav = useNavigate()
  const isGroup = id.startsWith('g:')
  const gid = isGroup ? id.slice(2) : ''
  const grp = store.groups.find(g => g.id === gid)
  const friend = isGroup ? undefined : store.friend(id)
  const [text, setText] = useState('')
  const [inviting, setInviting] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const msgs = isGroup ? store.groupMessages[gid] ?? [] : store.chats[id] ?? []
  const typing = !isGroup && store.typing[id]
  useEffect(() => { end.current?.scrollIntoView() }, [msgs.length, typing])
  useEffect(() => { if (!isGroup && friend && friend.unread > 0) store.markRead(id) }, [isGroup, id, friend?.unread]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!friend && !grp) return null
  const title = grp ? grp.name : friend!.name
  const members = store.groupMembers[gid] ?? []
  const nameOf = (from: string) => members.find(m => m.username.toLowerCase() === from.toLowerCase())?.name ?? from
  const gameId = friend?.presence.gameId
  const invitable = store.friends.filter(f => !members.some(m => m.username.toLowerCase() === f.username.toLowerCase()))

  return (
    <div className="chat">
      <div className="chat-head">
        {grp ? <div className="gicon sm"><Icon name="group" size={16} /></div> : <Avatar f={{ name: friend!.name, status: friend!.presence.status }} size={26} />}
        <div className="chat-title"><b>{title}</b>{friend && <span className="small muted">{statusLine(friend)}</span>}{grp && members.length > 0 && <span className="small muted">{members.map(m => m.name).join(', ')}</span>}</div>
        <span className="grow" />
        {friend && <button className="link-btn small" onClick={() => nav(`/profile/${friend.username}`)}>Profile</button>}
        {gameId && <button className="link-btn small" onClick={() => nav(`/store/${gameId}`)}>Store Page</button>}
        {grp && <button className="link-btn small" onClick={() => setInviting(!inviting)}>Invite</button>}
        {grp && <button className="link-btn small" onClick={() => void store.leaveGroup(gid)}>Leave</button>}
        <button className="icon-btn" onClick={() => store.closeChat(id)} aria-label="Close chat"><Icon name="close" size={18} /></button>
      </div>
      {inviting && grp && (
        <div className="chat-invite">
          {invitable.length === 0 ? <span className="small muted">All your friends are already here.</span> : invitable.map(f => (
            <button key={f.username} className="btn small" onClick={async () => { const e = await store.inviteToGroup(gid, f.username); if (e) store.toast(e); else setInviting(false) }}>{f.name}</button>
          ))}
        </div>
      )}
      <div className="chat-log">
        {msgs.length === 0 && <div className="muted small center">Say hi to {title}.</div>}
        {msgs.map((m, i) => (
          <div key={m.id ?? i} className={`msg ${m.from === 'me' ? 'me' : ''}`} title={new Date(m.at).toLocaleString()}>
            {grp && m.from !== 'me' && <span className="msg-from">{nameOf(m.from)}</span>}{m.text}
          </div>
        ))}
        {typing && <div className="muted small">{friend!.name} is typing…</div>}
        <div ref={end} />
      </div>
      <form className="chat-form" onSubmit={async e => { e.preventDefault(); const t = text; setText(''); const err = isGroup ? await store.sendGroup(gid, t) : await store.send(id, t); if (err) setText(t) }}>
        <input className="input" maxLength={500} placeholder={friend?.presence.status === 'offline' ? `${friend.name} is offline — they will see this later` : t('friends.send')} value={text}
          onChange={e => { setText(e.target.value); if (friend) store.sendTyping(friend.username) }} />
      </form>
    </div>
  )
})

const ChatWindows = observer(() => (
  <div className={`chat-windows ${store.friendsOpen ? 'with-friends' : ''}`}>
    {store.openChats.map(id => <ChatWindow key={id} id={id} />)}
  </div>
))
