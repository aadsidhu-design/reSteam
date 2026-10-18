import { useState } from 'react'
import { NavLink, Link, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { gameNews, type Game } from './data'
import { store, type Shelf as ShelfKind } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Avatar, Modal, Shelf, ago, hours, useDismiss } from './ui'
import './library.css'

const customToGame = (c: { id: number; title: string }): Game => ({
  id: c.id, title: c.title, dev: 'Local', publisher: 'Local', genre: [], tags: [], price: 0, discount: 0, rating: 0, reviews: 0,
  released: '', blurb: 'A non-store game added from this browser.', hue: [...c.title].reduce((h, ch) => (h + ch.charCodeAt(0) * 7) % 360, 0),
  motif: 'circuit', achievements: 0, sizeGb: 0,
})

const allGames = () => [...store.ownedGames, ...store.customGames.map(customToGame)]
const isInstalled = (g: Game) => g.id >= 1000 || store.installed.includes(g.id)

type Cat = 'all' | 'games' | 'software'
const SHELF_LABEL: Record<ShelfKind, string> = { whatsnew: "What's New", recent: 'Recent Games', favorites: 'Favorites', playnext: 'Play Next', installed: 'Installed' }

const recentGroup = (t?: number) => {
  if (!t) return 'Recently added'
  const days = (Date.now() - t) / 86_400_000
  if (days < 7) return 'This week'
  return new Date(t).toLocaleDateString('en-US', { month: 'long', year: days > 300 ? 'numeric' : undefined })
}

const Capsule = observer(({ g, wide = false }: { g: Game; wide?: boolean }) => {
  const installed = isInstalled(g)
  return (
    <Link to={`/library/${g.id}`} className={`capsule ${wide ? 'wide' : ''}`} draggable={false}>
      <div className="cap-art"><Art game={g} kind={wide ? 'wide' : 'capsule'} />{!installed && <span className="cap-dl"><Icon name="download" size={20} /></span>}</div>
      {wide && (
        <div className="played-panel">
          <div className="pp-btn"><Icon name="download" size={30} /></div>
          <div>
            <div className="caps">Time played</div>
            <div className="pp-line">Last two weeks: {hours(store.playtime[g.id] ?? 0)}</div>
            <div className="pp-line">Total: {hours(store.playtime[g.id] ?? 0)}</div>
          </div>
        </div>
      )}
    </Link>
  )
})

const ShelfHeader = ({ title, sub, onRemove, caret = false }: { title: string; sub?: string; onRemove?: () => void; caret?: boolean }) => {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  return (
    <div className="shelf-head" ref={ref}>
      <h3>{title}</h3>
      {onRemove && (
        <span className="popwrap">
          <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={`${title} options`}><Icon name={caret ? 'chevronDown' : 'gear'} size={caret ? 22 : 18} /></button>
          {open && <div className="popover"><button className="pop-item" onClick={onRemove}>Hide this shelf</button></div>}
        </span>
      )}
      {sub && <span className="muted small shelf-sub">{sub}</span>}
    </div>
  )
}

const Home = observer(() => {
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useDismiss(addOpen, () => setAddOpen(false))
  const owned = allGames()
  const recent = [...owned].sort((a, b) => (store.lastPlayed[b.id] ?? 0) - (store.lastPlayed[a.id] ?? 0)).slice(0, 12)
  const missing = (Object.keys(SHELF_LABEL) as ShelfKind[]).filter(s => !store.shelves.includes(s))

  const renderShelf = (s: ShelfKind) => {
    const rm = () => store.removeShelf(s)
    switch (s) {
      case 'whatsnew': {
        const items = store.ownedGames.slice(0, 8)
        return (
          <section className="shelf whatsnew" key={s}>
            <ShelfHeader title="What's New" onRemove={rm} />
            {items.length === 0 ? <p className="muted">Updates for games you own will appear here.</p> : (
              <Shelf step={800}>
                {items.map(g => {
                  const n = gameNews(g)
                  return (
                    <Link key={g.id} to={`/library/${g.id}`} className="news-card">
                      <div className="muted small nc-when">{n.when}</div>
                      <div className="nc-art"><Art game={g} kind="wide" variant={1} showTitle={false} /></div>
                      <div className="nc-title">{n.title.split(': ')[1]}</div>
                      <div className="nc-game"><Art game={g} kind="icon" className="nc-icon" /> {g.title}</div>
                    </Link>
                  )
                })}
              </Shelf>
            )}
          </section>
        )
      }
      case 'recent':
        return (
          <section className="shelf" key={s}>
            <ShelfHeader title="Recent Games" onRemove={rm} caret />
            {recent.length === 0 ? (
              <div className="panel"><p>You have ({owned.length}) games.</p><Link to="/store">Visit the store to find games to add</Link></div>
            ) : (
              <Shelf step={700}>
                {recent.map((g, i) => {
                  const grp = recentGroup(store.lastPlayed[g.id])
                  const first = i === 0 || recentGroup(store.lastPlayed[recent[i - 1].id]) !== grp
                  return (
                    <div className="recent-col" key={g.id}>
                      <div className="muted small group-label">{first ? grp : ' '}</div>
                      <Capsule g={g} wide={i === 0} />
                    </div>
                  )
                })}
              </Shelf>
            )}
          </section>
        )
      case 'favorites': case 'playnext': case 'installed': {
        const list = s === 'favorites' ? owned.filter(g => store.favorites.includes(g.id))
          : s === 'installed' ? owned.filter(isInstalled)
          : owned.filter(g => !store.playtime[g.id] && !isInstalled(g))
        return (
          <section className="shelf" key={s}>
            <ShelfHeader title={SHELF_LABEL[s]} sub={s === 'playnext' ? 'Games in your library you have not played yet' : undefined} onRemove={rm} />
            {list.length === 0 ? <p className="muted">Nothing here yet.</p> : <Shelf>{list.map(g => <div className="recent-col" key={g.id}><Capsule g={g} /></div>)}</Shelf>}
          </section>
        )
      }
    }
  }

  return (
    <div className="lib-home">
      {store.shelves.filter(s => s === 'whatsnew').map(renderShelf)}
      <div className="addshelf popwrap" ref={addRef}>
        <button className="addshelf-btn" onClick={() => setAddOpen(!addOpen)} disabled={missing.length === 0}><Icon name="plus" size={20} /> Add shelf</button>
        {addOpen && (
          <div className="popover" style={{ left: 'calc(50% - 130px)' }}>
            {missing.map(s => <button key={s} className="pop-item" onClick={() => { store.addShelf(s); setAddOpen(false) }}>{SHELF_LABEL[s]}</button>)}
          </div>
        )}
      </div>
      <div className="shelves-body">{store.shelves.filter(s => s !== 'whatsnew').map(renderShelf)}</div>
    </div>
  )
})

const GridView = observer(({ list }: { list: Game[] }) => (
  <div className="lib-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${store.settings.gridSize}px, 1fr))` }}>
    {list.map(g => <Capsule key={g.id} g={g} />)}
    {list.length === 0 && <p className="muted">No games match.</p>}
  </div>
))

export const Library = observer(() => {
  const { id } = useParams()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Cat>('all')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const [favOnly, setFavOnly] = useState(false)
  const [ctx, setCtx] = useState<{ x: number; y: number; g: Game } | null>(null)
  const filterRef = useDismiss(filterOpen, () => setFilterOpen(false))
  const ctxRef = useDismiss(!!ctx, () => setCtx(null))

  const all = allGames()
  let list = all.filter(g => g.title.toLowerCase().includes(q.toLowerCase()))
  if (cat === 'games') list = list.filter(g => g.id < 1000)
  if (cat === 'software') list = list.filter(g => g.id >= 1000)
  if (store.installedOnly) list = list.filter(isInstalled)
  if (favOnly) list = list.filter(g => store.favorites.includes(g.id))
  list = [...list].sort((a, b) => store.recentSort ? (store.lastPlayed[b.id] ?? 0) - (store.lastPlayed[a.id] ?? 0) : a.title.localeCompare(b.title))
  const favs = list.filter(g => store.favorites.includes(g.id))
  const rest = list.filter(g => !store.favorites.includes(g.id))
  const sel = all.find(g => g.id === Number(id))

  const section = (key: string, title: string, items: Game[]) => (
    <>
      <button className="sec-head" onClick={() => setCollapsed({ ...collapsed, [key]: !collapsed[key] })}>
        <span className="dash">{collapsed[key] ? '+' : '–'}</span> {title} <span className="muted">({items.length})</span>
      </button>
      {!collapsed[key] && items.map(g => (
        <NavLink
          key={g.id} to={`/library/${g.id}`} className="lib-item"
          onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, g }) }}
        >
          <Art game={g} kind="icon" className="sicon" />
          <span className={`lib-name ${isInstalled(g) ? '' : 'dim'}`}>{g.title}</span>
          {store.running === g.id && <span className="running">Running</span>}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="library">
      <aside className="lib-side">
        <div className="side-top">
          <NavLink to="/library" end className="home-btn">Home</NavLink>
          <button className={`gridbtn ${store.libraryGrid ? 'on' : ''}`} onClick={() => { store.libraryGrid = !store.libraryGrid; nav('/library') }} aria-label="Toggle grid view" title="Grid view"><Icon name="grid" size={28} /></button>
        </div>
        <div className="side-filters">
          <select className="catsel" value={cat} onChange={e => setCat(e.target.value as Cat)} aria-label="Category">
            <option value="all">Games and Software</option>
            <option value="games">Games</option>
            <option value="software">Software</option>
          </select>
          <button className="fbtn" disabled title="All games work on this computer"><Icon name="monitor" size={18} /></button>
          <button className={`fbtn ${store.recentSort ? 'on' : ''}`} onClick={() => (store.recentSort = !store.recentSort)} title="Sort by recent activity"><Icon name="clock" size={18} /></button>
          <button className={`fbtn ${store.installedOnly ? 'on' : ''}`} onClick={() => (store.installedOnly = !store.installedOnly)} title="Ready to play"><Icon name="playCircle" size={18} /></button>
        </div>
        <div className="side-search popwrap" ref={filterRef}>
          <Icon name="search" size={20} className="ss-icon" />
          <input value={q} onChange={e => setQ(e.target.value)} aria-label="Search library" />
          <button className="icon-btn" onClick={() => setFilterOpen(!filterOpen)} aria-label="Filters"><Icon name="filter" size={22} /></button>
          {filterOpen && (
            <div className="popover right" style={{ minWidth: 220 }}>
              <label className="pop-item static check"><input type="checkbox" checked={store.installedOnly} onChange={() => (store.installedOnly = !store.installedOnly)} /> Installed</label>
              <label className="pop-item static check"><input type="checkbox" checked={favOnly} onChange={() => setFavOnly(!favOnly)} /> Favorites</label>
            </div>
          )}
        </div>
        <div className="side-list">
          {favs.length > 0 && section('fav', 'FAVORITES', favs)}
          {section('rest', favs.length > 0 ? 'UNCATEGORIZED' : 'ALL GAMES', rest)}
          {list.length === 0 && <div className="muted small side-empty">No games match.</div>}
        </div>
      </aside>
      <section className="lib-main">
        {sel ? <LibGame g={sel} /> : store.libraryGrid ? <GridView list={list} /> : <Home />}
      </section>
      {ctx && (
        <div className="ctx popover" ref={ctxRef} style={{ position: 'fixed', left: ctx.x, top: ctx.y, minWidth: 220 }}>
          {isInstalled(ctx.g)
            ? <button className="pop-item" onClick={() => { setCtx(null); nav(`/library/${ctx.g.id}`); store.play(ctx.g.id) }} disabled={store.running !== null}>Play</button>
            : ctx.g.id < 1000 && <button className="pop-item" onClick={() => { setCtx(null); store.install(ctx.g.id) }}>Install</button>}
          <button className="pop-item" onClick={() => { store.toggleFavorite(ctx.g.id); setCtx(null) }}>{store.favorites.includes(ctx.g.id) ? 'Remove from favorites' : 'Add to favorites'}</button>
          {ctx.g.id < 1000 && <button className="pop-item" onClick={() => { setCtx(null); nav(`/store/${ctx.g.id}`) }}>View store page</button>}
          {ctx.g.id < 1000 && isInstalled(ctx.g) && <button className="pop-item" onClick={() => { store.uninstall(ctx.g.id); setCtx(null) }}>Uninstall</button>}
        </div>
      )}
    </div>
  )
})

const LibGame = observer(({ g }: { g: Game }) => {
  const nav = useNavigate()
  const [gear, setGear] = useState(false)
  const [info, setInfo] = useState(false)
  const [caret, setCaret] = useState(false)
  const [post, setPost] = useState('')
  const gearRef = useDismiss(gear, () => setGear(false))
  const caretRef = useDismiss(caret, () => setCaret(false))
  const custom = g.id >= 1000
  const installed = isInstalled(g)
  const dl = store.queue.find(d => d.id === g.id)
  const running = store.running === g.id
  const fav = store.favorites.includes(g.id)
  const played = store.playtime[g.id] ?? 0
  const unlocked = Math.min(g.achievements, Math.floor(played / 3))
  // friends playing now, plus a stable pseudo-random few who have played before
  const playingNow = store.friends.filter(f => f.gameId === g.id)
  const previously = store.friends.filter(f => f.status !== 'pending' && f.gameId !== g.id && ([...f.id].reduce((h, c) => h + c.charCodeAt(0), 0) + g.id) % 3 === 0)
  const friends = [...playingNow, ...previously]
  const news = gameNews(g)
  const posts = store.posts[g.id] ?? []

  return (
    <div className="gamepage">
      <div className="gp-hero">
        <Art game={g} kind="hero" />
        <div className="gp-fade" />
      </div>
      <div className="gp-bar">
        <div className="gp-action">
          {running ? (
            <button className="btn red big" onClick={() => store.stop()}><Icon name="close" size={26} /> STOP</button>
          ) : installed ? (
            <button className="btn play big" disabled={store.running !== null} onClick={() => store.play(g.id)}><Icon name="play" size={28} /> PLAY</button>
          ) : dl ? (
            <button className="btn big blue" onClick={() => (dl.paused ? store.resume(g.id) : store.pause(g.id))}>
              <Icon name={dl.paused ? 'play' : 'pause'} size={26} /> {dl.paused ? 'RESUME' : 'PAUSE'}
            </button>
          ) : (
            <span className="split popwrap" ref={caretRef}>
              <button className="btn big blue" onClick={() => store.install(g.id)}><Icon name="download" size={26} /> INSTALL</button>
              <button className="btn blue caret" onClick={() => setCaret(!caret)} aria-label="Install options"><Icon name="chevronDown" size={22} /></button>
              {caret && (
                <div className="popover" style={{ left: 0 }}>
                  <button className="pop-item" onClick={() => { setCaret(false); store.install(g.id); nav('/downloads') }}>Install and open Downloads</button>
                  <button className="pop-item" onClick={() => { setCaret(false); nav(`/store/${g.id}`) }}>View store page</button>
                </div>
              )}
            </span>
          )}
        </div>
        <div className="gp-stat"><div className="caps">{installed ? 'Last played' : 'Space required'}</div><div className="gp-val">{installed ? ago(store.lastPlayed[g.id]) : `${g.sizeGb.toFixed(2)} GB`}</div></div>
        {!installed && <div className="gp-stat"><div className="caps">Last played</div><div className="gp-val">{ago(store.lastPlayed[g.id])}</div></div>}
        <div className="gp-stat with-icon"><Icon name="clock" size={30} className="gs-icon" /><div><div className="caps">Play time</div><div className="gp-val">{hours(played)}</div></div></div>
        {!custom && (
          <div className="gp-stat with-icon">
            <Icon name="star" size={30} className="gs-icon" />
            <div>
              <div className="caps">Achievements</div>
              <div className="gp-val">{unlocked}/{g.achievements}</div>
              <div className="ach-bar"><span style={{ width: `${(unlocked / Math.max(1, g.achievements)) * 100}%` }} /></div>
            </div>
          </div>
        )}
        <div className="grow" />
        <div className="gp-icons popwrap" ref={gearRef}>
          <button className="sq-btn" onClick={() => setGear(!gear)} aria-label="Manage"><Icon name="gear" size={22} /></button>
          <button className="sq-btn" onClick={() => setInfo(true)} aria-label="Game info"><Icon name="info" size={22} /></button>
          <button className={`sq-btn ${fav ? 'fav' : ''}`} onClick={() => store.toggleFavorite(g.id)} aria-label="Favorite"><Icon name="heart" size={22} /></button>
          {gear && (
            <div className="popover right">
              <button className="pop-item" onClick={() => { store.toggleFavorite(g.id); setGear(false) }}>{fav ? 'Remove from favorites' : 'Add to favorites'}</button>
              {!custom && installed && !running && <button className="pop-item" onClick={() => { store.uninstall(g.id); setGear(false) }}>Uninstall</button>}
              {!custom && <button className="pop-item" onClick={() => { setGear(false); nav(`/store/${g.id}`) }}>View store page</button>}
            </div>
          )}
        </div>
      </div>
      {dl && (
        <div className="gp-progress">
          <div className="gp-prog-bar"><span style={{ width: `${dl.progress}%` }} /></div>
          <div className="small muted">{dl.paused ? 'Paused' : dl.phase} · {Math.floor(dl.progress)}% · <Link to="/downloads">Manage Downloads</Link></div>
        </div>
      )}
      <div className="gp-tabs">
        {custom ? <span className="muted">Non-store game</span> : (
          <>
            <Link to={`/store/${g.id}`}>Store Page</Link>
            <Link to={`/community?hub=${g.id}`}>Community Hub</Link>
            <button className="tabdis" onClick={() => store.toast('Points Shop is not part of reSteam')}>Points Shop</button>
            <Link to={`/community?hub=${g.id}&tab=Discussions`}>Discussions</Link>
            <Link to={`/community?hub=${g.id}&tab=Guides`}>Guides</Link>
            <button className="tabdis" onClick={() => store.toast('Support is not part of reSteam')}>Support</button>
          </>
        )}
      </div>
      <div className="gp-body">
        <div className="gp-left">
          <h2>Activity</h2>
          <form className="postbox" onSubmit={e => { e.preventDefault(); store.post(g.id, post); setPost('') }}>
            <input className="input" placeholder="Say something about this game to your friends..." value={post} onChange={e => setPost(e.target.value)} maxLength={300} />
          </form>
          {!custom && <div className="viewnews"><Link to={`/community?hub=${g.id}&tab=News`}>View Latest News</Link></div>}
          {posts.map(p => (
            <div className="act-entry" key={p.at}>
              <div className="act-date">{new Date(p.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}</div>
              <div className="act-row"><Avatar f={{ name: store.name, hue: 210, status: store.status }} size={34} ring={false} /><div><span className="pos">{store.name}</span> posted: {p.text}</div></div>
            </div>
          ))}
          {!custom && (
            <div className="act-entry">
              <div className="act-date">{news.when.toUpperCase()}</div>
              <div className="act-row"><div className="news-thumb"><Art game={g} kind="header" variant={2} showTitle={false} /></div><div><b>{news.title}</b><div className="muted small">{news.body}</div></div></div>
            </div>
          )}
          {played > 0 && (
            <div className="act-entry">
              <div className="act-date">{ago(store.lastPlayed[g.id]).toUpperCase()}</div>
              <div className="act-row"><Avatar f={{ name: store.name, hue: 210, status: store.status }} size={34} ring={false} /><div><span className="pos">{store.name}</span> played {g.title} for {hours(played)} in total</div></div>
            </div>
          )}
        </div>
        <div className="gp-right">
          {!custom && (
            <div className="side-panel">
              <h2>Friends who play</h2>
              <div className="sp-box">
                {friends.length > 0 ? (
                  <>
                    <div>{playingNow.length > 0 ? `${playingNow.length} friend${playingNow.length > 1 ? 's' : ''} playing now` : `${previously.length} friend${previously.length > 1 ? 's have' : ' has'} played previously`}</div>
                    <div className="avatars">{friends.map(f => <Avatar key={f.id} f={f} size={34} />)}</div>
                  </>
                ) : <div className="muted">None of your friends have played this</div>}
                <button className="link-btn viewall" onClick={() => (store.friendsOpen = true)}>View all friends who play</button>
              </div>
            </div>
          )}
        </div>
      </div>
      {info && (
        <Modal title={g.title} onClose={() => setInfo(false)}>
          <dl className="kv">
            <dt>Developer</dt><dd>{g.dev}</dd>
            {!custom && <><dt>Publisher</dt><dd>{g.publisher}</dd><dt>Released</dt><dd>{g.released}</dd><dt>Install size</dt><dd>{g.sizeGb.toFixed(1)} GB</dd><dt>Tags</dt><dd>{g.tags.join(', ')}</dd></>}
            <dt>Play time</dt><dd>{hours(played)}</dd>
          </dl>
        </Modal>
      )}
    </div>
  )
})
