import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, lastOnline, type Friend } from './data'
import { store } from './store'
import { Icon } from './icons'
import { Avatar, Modal, nameHue, useDismiss } from './ui'
import './friends.css'

const gameName = (f: Friend) => GAMES.find(g => g.id === f.gameId)?.title
const statusLine = (f: Friend) =>
  f.status === 'ingame' ? `Playing ${gameName(f) ?? 'a game'}` : f.status === 'online' ? 'Online' : f.status === 'away' ? 'Away'
  : f.status === 'pending' ? 'Invite sent' : `Last online ${lastOnline(f.id)}`

const Row = observer(({ f, onMenu, onOpen }: { f: Friend; onMenu: (e: React.MouseEvent, f: Friend) => void; onOpen: () => void }) => (
  <button className={`frow ${f.status === 'pending' ? 'dim' : ''}`} disabled={f.status === 'pending'} draggable={f.status !== 'pending'} onDragStart={e => { e.dataTransfer.setData('text/friend', f.id); e.dataTransfer.effectAllowed = 'copy' }} onClick={onOpen} onContextMenu={e => onMenu(e, f)}>
    <Avatar f={f} size={46} />
    <div className="finfo">
      <div className={`fname st-${f.status}`}>{f.name}</div>
      <div className="fstatus">{statusLine(f)}</div>
    </div>
  </button>
))

export const FriendsWindow = observer(() => {
  const nav = useNavigate()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const [statusMenu, setStatusMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addName, setAddName] = useState('')
  const [addMsg, setAddMsg] = useState('')
  const [sortAsc, setSortAsc] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [ctx, setCtx] = useState<{ x: number; y: number; f: Friend } | null>(null)
  const [profile, setProfile] = useState<Friend | null>(null)
  const [newGroup, setNewGroup] = useState(false)
  const [dropHot, setDropHot] = useState(false)
  const dropFav = (e: React.DragEvent) => { e.preventDefault(); setDropHot(false); const id = e.dataTransfer.getData('text/friend'); if (id && !store.favFriends.includes(id)) store.toggleFavFriend(id) }
  const statusRef = useDismiss(statusMenu, () => setStatusMenu(false))
  const ctxRef = useDismiss(!!ctx, () => setCtx(null))
  const me = { name: store.name, hue: nameHue(store.name), status: store.status }

  useEffect(() => {
    const move = (e: PointerEvent) => { if (drag.current) setPos({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }) }
    const up = () => { drag.current = null }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])

  if (!store.friendsOpen) return <ChatWindows />

  const q = search.trim().toLowerCase()
  const byName = (a: Friend, b: Friend) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name) * -1)
  const list = store.friends.filter(f => !q || f.name.toLowerCase().includes(q)).sort(byName)
  const groups: [string, Friend[]][] = [
    ['In-Game', list.filter(f => f.status === 'ingame')],
    ['Online', list.filter(f => f.status === 'online' || f.status === 'away')],
    ['Offline', list.filter(f => f.status === 'offline')],
    ['Pending', list.filter(f => f.status === 'pending')],
  ]

  const openMenu = (e: React.MouseEvent, f: Friend) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, f }) }
  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {}

  return (
    <>
      <ChatWindows />
      <div className="fwin" style={style} role="dialog" aria-label="Friends and chat">
        <div className="fhead" onPointerDown={e => {
          if ((e.target as HTMLElement).closest('button, .popover')) return
          const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
        }}>
          <div className="fctl"><i className="r" onClick={() => (store.friendsOpen = false)} title="Close" /><i className="y" /><i className="g" /></div>
          <div className="fme">
            <Avatar f={me} size={52} ring={false} />
            <div className="popwrap" ref={statusRef}>
              <button className="fme-name" onClick={() => setStatusMenu(!statusMenu)}>{store.name} <Icon name="chevronDown" size={16} /></button>
              <div className="fme-status">{store.status === 'offline' ? 'Invisible' : store.status === 'away' ? 'Away' : 'Online'}</div>
              {statusMenu && (
                <div className="popover" style={{ left: 0, minWidth: 180 }}>
                  {(['online', 'away', 'offline'] as const).map(s => (
                    <button key={s} className="pop-item" onClick={() => { store.setStatus(s); setStatusMenu(false) }}>{s === 'offline' ? 'Invisible' : s[0].toUpperCase() + s.slice(1)}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {store.favFriends.length > 0 ? (
          <div className={`ffav ${dropHot ? 'hot' : ''}`} onDragOver={e => { e.preventDefault(); setDropHot(true) }} onDragLeave={() => setDropHot(false)} onDrop={dropFav}>
            {store.favFriends.map(id => store.friends.find(x => x.id === id)).filter((f): f is Friend => !!f).map(f => (
              <button key={f.id} className="fav-chip" onClick={() => store.openChat(f.id)} onContextMenu={e => openMenu(e, f)} title={`${f.name} — ${statusLine(f)}`}><Avatar f={f} size={40} /><span>{f.name}</span></button>
            ))}
          </div>
        ) : !store.hints.drag && (
          <div className={`fhint ${dropHot ? 'hot' : ''}`} onDragOver={e => { e.preventDefault(); setDropHot(true) }} onDragLeave={() => setDropHot(false)} onDrop={dropFav}><span>Drag Friends &amp; Chats here for easy access</span><button className="gotit" onClick={() => (store.hints.drag = true)}>GOT IT!</button></div>
        )}

        <div className="fbar">
          <span>FRIENDS</span><span className="grow" />
          <button className="icon-btn" onClick={() => { setSearching(!searching); setSearch('') }} aria-label="Search friends"><Icon name="search" size={22} /></button>
          <button className="icon-btn" onClick={() => setAdding(!adding)} aria-label="Add a friend"><Icon name="personAdd" size={24} /></button>
        </div>
        {searching && <div className="fextra"><input className="input" autoFocus placeholder="Search friends" value={search} onChange={e => setSearch(e.target.value)} /></div>}
        {adding && (
          <form className="fextra" onSubmit={async e => { e.preventDefault(); const err = await store.addFriend(addName); setAddMsg(err ?? `Friend request sent to ${addName.trim()}`); if (!err) setAddName('') }}>
            <input className="input" autoFocus placeholder="Add a friend by name" value={addName} onChange={e => { setAddName(e.target.value); setAddMsg('') }} />
            {addMsg && <div className={`small ${addMsg.startsWith('Friend request') ? 'pos' : 'err'}`}>{addMsg}</div>}
            <div className="muted small">Your friend code: <b>{store.friendCode}</b></div>
          </form>
        )}

        <div className="flist">
          {groups.map(([name, items], gi) => items.length > 0 && (
            <div key={name}>
              <div className="ghead">
                <button className="gtoggle" onClick={() => setCollapsed({ ...collapsed, [name]: !collapsed[name] })}>
                  <Icon name={collapsed[name] ? 'chevronRight' : 'chevronDown'} size={18} /> {name} <span className="muted">({items.length})</span>
                </button>
                {gi === groups.findIndex(g => g[1].length > 0) && <button className="icon-btn az" onClick={() => setSortAsc(!sortAsc)} aria-label="Sort A to Z" title="Sort A to Z">A↓Z</button>}
              </div>
              {!collapsed[name] && items.map(f => <Row key={f.id} f={f} onMenu={openMenu} onOpen={() => store.openChat(f.id)} />)}
            </div>
          ))}
          {list.length === 0 && <p className="muted fempty">No friends match.</p>}
        </div>

        <div className="gbar">
          <button className="gtoggle" onClick={() => setCollapsed({ ...collapsed, groups: !collapsed.groups })}><Icon name={collapsed.groups ? 'chevronRight' : 'chevronDown'} size={18} /> GROUP CHATS</button>
          <span className="grow" />
          <button className="icon-btn round" onClick={() => setNewGroup(true)} aria-label="Start a group chat"><Icon name="plus" size={22} /></button>
        </div>
        {!collapsed.groups && (
          <div className="gbody">
            {store.groups.length === 0 ? (
              <p className="muted">Any group chats you are part of will be listed here.<br />You can start a chat with friends or join a group chat.</p>
            ) : store.groups.map(g => (
              <button key={g.id} className="frow" onClick={() => store.openChat(g.id)}>
                <div className="gicon"><Icon name="group" size={24} /></div>
                <div className="finfo"><div className="fname">{g.name}</div><div className="fstatus">{g.members.length + 1} members</div></div>
              </button>
            ))}
          </div>
        )}
      </div>

      {ctx && (
        <div className="popover" ref={ctxRef} style={{ position: 'fixed', left: Math.min(ctx.x, window.innerWidth - 250), top: Math.min(ctx.y, window.innerHeight - 260), minWidth: 230, zIndex: 90 }}>
          {ctx.f.status !== 'pending' && <button className="pop-item" onClick={() => { store.openChat(ctx.f.id); setCtx(null) }}>Send Message</button>}
          {ctx.f.status !== 'pending' && <button className="pop-item" onClick={() => { store.toggleFavFriend(ctx.f.id); setCtx(null) }}>{store.favFriends.includes(ctx.f.id) ? 'Remove from Favorites' : 'Add to Favorites'}</button>}
          <button className="pop-item" onClick={() => { setProfile(ctx.f); setCtx(null) }}>View Profile</button>
          {ctx.f.gameId && <button className="pop-item" onClick={() => { nav(`/store/${ctx.f.gameId}`); setCtx(null) }}>Store Page</button>}
          {ctx.f.gameId && store.owned.includes(ctx.f.gameId) && <button className="pop-item" onClick={() => { nav(`/library/${ctx.f.gameId}`); setCtx(null) }}>View Game in Library</button>}
          {ctx.f.status !== 'pending' && ctx.f.status !== 'offline' && <button className="pop-item" onClick={() => { store.toast(`Invite sent to ${ctx.f.name}`); setCtx(null) }}>Invite to Play</button>}
          <button className="pop-item" onClick={() => { setCtx(null); if (ctx.f.custom) void store.removeFriend(ctx.f.id); else store.toast('Built-in friends cannot be removed') }}>Remove Friend</button>
        </div>
      )}
      {profile && (
        <Modal title={`${profile.name}'s profile`} onClose={() => setProfile(null)} width={420}>
          <div className="prof-top"><Avatar f={profile} size={72} /><div><div className="prof-name">{profile.name}</div><div className="muted">{statusLine(profile)}</div></div></div>
          {profile.gameId && <p>Currently playing <Link to={`/store/${profile.gameId}`} onClick={() => setProfile(null)}>{gameName(profile)}</Link></p>}
        </Modal>
      )}
      {newGroup && <GroupModal onClose={() => setNewGroup(false)} />}
    </>
  )
})

function GroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const choices = store.friends.filter(f => f.status !== 'pending')
  return (
    <Modal title="Start a group chat" onClose={onClose}>
      <input className="input" autoFocus placeholder="Group name" value={name} maxLength={30} onChange={e => setName(e.target.value)} />
      <div className="pick-list">
        {choices.map(f => (
          <label key={f.id} className="pick"><input type="checkbox" checked={picked.includes(f.id)} onChange={() => setPicked(picked.includes(f.id) ? picked.filter(x => x !== f.id) : [...picked, f.id])} /> <Avatar f={f} size={26} /> {f.name}</label>
        ))}
      </div>
      <div className="modal-actions"><button className="btn" onClick={onClose}>Cancel</button><button className="btn blue" disabled={picked.length === 0} onClick={() => { store.createGroup(name, picked); onClose() }}>Create</button></div>
    </Modal>
  )
}

const ChatWindow = observer(({ id }: { id: string }) => {
  const nav = useNavigate()
  const isGroup = id.startsWith('g')
  const grp = store.groups.find(g => g.id === id)
  const friend = store.friends.find(x => x.id === id)
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const msgs = isGroup ? grp?.messages ?? [] : store.chats[id] ?? []
  useEffect(() => { end.current?.scrollIntoView() }, [msgs.length, store.typing[id]])
  if (!friend && !grp) return null
  const title = grp ? grp.name : friend!.name
  const nameOf = (from: string) => store.friends.find(f => f.id === from)?.name ?? from

  return (
    <div className="chat">
      <div className="chat-head">
        {grp ? <div className="gicon sm"><Icon name="group" size={16} /></div> : <Avatar f={friend!} size={26} />}
        <b>{title}</b>
        <span className="grow" />
        {friend?.gameId && <button className="link-btn small" onClick={() => nav(`/store/${friend.gameId}`)}>Store Page</button>}
        {friend?.custom && <button className="link-btn small" onClick={() => store.removeFriend(id)}>Remove</button>}
        {grp && <button className="link-btn small" onClick={() => store.deleteGroup(id)}>Leave</button>}
        <button className="icon-btn" onClick={() => store.closeChat(id)} aria-label="Close chat"><Icon name="close" size={18} /></button>
      </div>
      <div className="chat-log">
        {msgs.length === 0 && <div className="muted small center">Say hi to {title}.</div>}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.from === 'me' ? 'me' : ''}`}>
            {grp && m.from !== 'me' && <span className="msg-from">{nameOf(m.from)}</span>}{m.text}
          </div>
        ))}
        {store.typing[id] && <div className="muted small">{grp ? 'Someone' : friend!.name} is typing…</div>}
        <div ref={end} />
      </div>
      <form className="chat-form" onSubmit={e => { e.preventDefault(); if (grp) store.sendGroup(id, text); else store.send(id, text); setText('') }}>
        <input className="input" placeholder={friend?.status === 'offline' ? `${friend.name} is offline — they will see this later` : 'Send a message'} value={text} onChange={e => setText(e.target.value)} />
      </form>
    </div>
  )
})

const ChatWindows = observer(() => (
  <div className={`chat-windows ${store.friendsOpen ? 'with-friends' : ''}`}>
    {store.openChats.map(id => <ChatWindow key={id} id={id} />)}
  </div>
))
