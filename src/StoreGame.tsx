import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact, fmt, priceOf, reviewLabel, type Game } from './data'
import { GameReviews } from './Reviews'
import { api, store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Price } from './ui'
import { Plats, reviewClass, Tags } from './StorePages'
import { t } from './i18n'
import { AchievementsModal } from './Achievements'

interface NewsItem { id: number; title: string; body: string; at: number; author: string }
const GameNews = ({ g }: { g: Game }) => {
  const [news, setNews] = useState<NewsItem[]>([])
  useEffect(() => { let live = true; void api<{ news: NewsItem[] }>('GET', `/games/${g.id}/news`).then(r => { if (live) setNews(r?.news ?? []) }); return () => { live = false } }, [g.id])
  if (news.length === 0) return null
  return (
    <>
      <h2 className="ul">{t('sg.news')}</h2>
      {news.slice(0, 3).map(n => (
        <div className="news-item" key={n.id}><b>{n.title}</b><div className="muted small">{new Date(n.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · {n.author}</div><p>{n.body}</p></div>
      ))}
    </>
  )
}

const Media = ({ g }: { g: Game }) => {
  const [i, setI] = useState(0)
  const real = g.shots ?? 0
  const thumbs = real > 0 ? Array.from({ length: real }, (_, k) => k) : [0, 1, 2, 3, 4, 5, 6]
  const shot = (n: number, title: boolean) => real > 0 ? <img className="art-svg art-img" src={`/api/games/${g.id}/shots/${n}`} alt={`${g.title} screenshot ${n + 1}`} /> : <Art game={g} kind="shot" variant={n} showTitle={title} />
  return (
    <div className="media">
      <div className="media-main">
        {shot(i, i === 0)}
        {real === 0 && i < 2 && <div className="play-over"><Icon name="play" size={54} /></div>}
        <button className="m-arrow l" onClick={() => setI((i + thumbs.length - 1) % thumbs.length)} aria-label={t('sg.prev')}><Icon name="chevronLeft" size={30} /></button>
        <button className="m-arrow r" onClick={() => setI((i + 1) % thumbs.length)} aria-label={t('sg.next')}><Icon name="chevronRight" size={30} /></button>
      </div>
      <div className="thumbs">{thumbs.map(n => (
        <button key={n} className={`thumb ${n === i ? 'on' : ''}`} onClick={() => setI(n)} aria-label={`Media ${n + 1}`}>
          {shot(n, false)}{real === 0 && n < 2 && <span className="thumb-play"><Icon name="play" size={20} /></span>}
        </button>))}
      </div>
    </div>
  )
}

export const StoreGame = observer(() => {
  const { id } = useParams()
  const nav = useNavigate()
  const g = GAMES.find(x => x.id === Number(id))
  const [allTags, setAllTags] = useState(false)
  const [achOpen, setAchOpen] = useState(false)
    useEffect(() => { if (g) store.view(g.id) }, [g])
  if (!g) return <div className="container"><h1>{t('sg.unavail')}</h1><Link to="/store">{t('dq.back')}</Link></div>

  const owned = store.owned.includes(g.id)
  const inCart = store.cart.includes(g.id)
  const wished = store.wishlist.includes(g.id)
  const installed = store.installed.includes(g.id)
  const queued = store.queue.some(d => d.id === g.id)
  const similar = GAMES.filter(x => x.id !== g.id && x.tags.some(t => g.tags.includes(t))).slice(0, 4)
  const friends = store.friendsPlaying(g.id)

  return (
    <div className="sg-wrap">
    <div className="sg-bd" aria-hidden><Art game={g} kind="hero" showTitle={false} /></div>
    {!store.signedIn && <div className="notsigned"><div><Link className="btn" to={`/login?next=${encodeURIComponent(`/store/${g.id}`)}`}>{t('game.signin')}</Link><span><b>{t('game.banner')}</b>{t('game.bannersub')}</span></div></div>}
    <div className="container sgame">
      <div className="crumbs"><Link to="/store/browse">All Games</Link> &gt; <Link to={`/store/browse?genre=${encodeURIComponent(g.genre[0])}`}>{g.genre[0]} Games</Link> &gt; <span>{g.title}</span></div>
      <div className="sg-title"><h1>{g.title}</h1><Link to={`/community?hub=${g.id}`} className="hubbtn">{t('game.hub')}</Link></div>

      <div className="sg-top">
        <Media g={g} />
        <div className="sg-side">
          <div className="sg-cap"><Art game={g} kind="header" /></div>
          <p className="sg-desc">{g.blurb}</p>
          <dl className="sg-kv">
            <dt>{t('sg.allrev')}:</dt><dd><span className={reviewClass(g.rating, g.reviews)}>{reviewLabel(g.rating, g.reviews)}</span>{g.reviews >= 10 && <span className="muted"> ({compact(g.reviews)})</span>}</dd>
            <dt>{t('sg.release')}:</dt><dd>{new Date(g.released).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
            <dt>{t('sg.dev')}:</dt><dd><Link to={`/store/browse?q=${encodeURIComponent(g.dev)}`}>{g.dev}</Link></dd>
            <dt>{t('sg.pub')}:</dt><dd><Link to={`/store/browse?q=${encodeURIComponent(g.publisher)}`}>{g.publisher}</Link></dd>
          </dl>
          <div className="sg-tags"><div className="muted small">{t('sg.tags')}</div>
            <div className="tagrow">{(allTags ? g.tags : g.tags.slice(0, 5)).map(t => <Link key={t} to={`/store/browse?tag=${encodeURIComponent(t)}`} className="tagchip">{t}</Link>)}
              <button className="tagchip plus" onClick={() => setAllTags(!allTags)} aria-label="Toggle tags">{allTags ? '–' : '+'}</button></div></div>
        </div>
      </div>

      <div className="sg-signed">
        {!store.signedIn ? <div className="sg-btns small"><span><Link to={`/login?next=${encodeURIComponent(`/store/${g.id}`)}`}><b>{t('game.signin')}</b></Link> {t('sg.signbar')}</span></div> : (
        <div className="sg-btns">
          <button className={`btn ${wished ? 'blue' : ''}`} onClick={() => store.toggleWishlist(g.id)} disabled={owned}>{wished ? 'On Wishlist ✓' : t('game.wish')}</button>
          <button className={`btn ${store.followed.includes(g.id) ? 'blue' : ''}`} onClick={() => { store.toggleFollow(g.id); store.toast(store.followed.includes(g.id) ? `Following ${g.title}` : `Unfollowed ${g.title}`) }}>{store.followed.includes(g.id) ? 'Following ✓' : t('game.follow')}</button>
          <button className={`btn ${store.ignored.includes(g.id) ? 'red' : ''}`} onClick={() => { store.toggleIgnore(g.id); store.toast(store.ignored.includes(g.id) ? `${g.title} is now ignored and will be hidden from the store` : `${g.title} is no longer ignored`) }}>{store.ignored.includes(g.id) ? 'Ignored ✓' : t('game.ignore')}</button>
          {friends.length > 0 && <span className="muted small">{friends.map(f => f.name).join(', ')} playing now</span>}
        </div>
        )}
        <button className="sharebtn" aria-label={t('sg.copy')} title={t('sg.copy')} onClick={() => { void navigator.clipboard?.writeText(location.href); store.toast('Link copied') }}><Icon name="share" size={20} /></button>
      </div>

      <div className="sg-body">
        <div className="sg-main">
          <div className="buybox">
            <div className="bb-top"><h2 className="bb-title">{g.price === 0 ? t('game.play') + ' ' + g.title : t('game.buy', { title: g.title })}</h2><Plats /></div>
            <div className="bb-actions">
              {g.discount > 0 && <span className="bb-pct">-{g.discount}%</span>}
              <span className="bb-price">{g.discount > 0 && <s>{fmt(g.price)}</s>}<b>{fmt(priceOf(g))}</b></span>
              {owned ? (
                installed ? <button className="btn play" onClick={() => nav(`/library/${g.id}`)}>{t('sg.playlib')}</button>
                  : queued ? <Link to="/downloads" className="btn blue">{t('sg.installing')}</Link>
                  : <button className="btn blue" onClick={() => { store.install(g.id); nav('/downloads') }}><Icon name="download" size={18} /> Install</button>
              ) : g.price === 0 ? <button className="btn addcart" onClick={() => { store.claimFree(g.id); store.toast(`${g.title} was added to your library`) }}>{t('game.play')}</button>
                : inCart ? <Link to="/cart" className="btn addcart">{t('sg.incart')}</Link>
                : <button className="btn addcart" onClick={() => store.addToCart(g.id)}>{t('game.addcart')}</button>}
            </div>
          </div>

          <h2 className="ul">{t('sg.about')}</h2>
          <div className="about">
            <div className="about-img"><Art game={g} kind="wide" variant={3} showTitle={false} /></div>
            <p><b>{t('sg.overview')}</b> – {g.blurb}</p>
            <p>{g.title} is a {g.genre.join(' / ').toLowerCase()} game from {g.dev}. It has {g.achievements} achievements and takes up about {g.sizeGb.toFixed(1)} GB once installed.</p>
            <div className="about-img"><Art game={g} kind="wide" variant={5} showTitle={false} /></div>
            <p><b>{t('sg.features')}</b> – {g.tags.join(', ')}.</p>
          </div>

          <GameNews g={g} />
          <GameReviews g={g} />
        </div>

        <aside className="sg-rail">
          <div className="rail-box feats">
            <div className="feat-row"><span className="fi">●</span>{g.tags.includes('Multiplayer') || g.tags.includes('Co-op') ? t('sg.multi') : t('sg.single')}</div>
            <div className="feat-row"><span className="fi">✱</span>{t('sg.achcount', { n: String(g.achievements) })}</div>
            <div className="feat-row"><span className="fi">⇩</span>{t('sg.sizegb', { n: g.sizeGb.toFixed(1) })}</div>
            <div className="feat-row"><span className="fi">☷</span>{t('sg.owners', { n: compact(g.owners) })}</div>
          </div>
          <div className="rail-box"><div className="muted small">{t('sg.achievements')}</div>
            <div className="ach-tiles">{[0, 1, 2, 3].map(n => <div key={n} className="ach-tile"><Art game={g} kind="icon" variant={n} /></div>)}<button className="ach-more" onClick={() => setAchOpen(true)}>{t('sg.viewall')}<br />{g.achievements}</button></div></div>
          <div className="rail-box details">
            <div><span>{t('sg.title').toUpperCase()}:</span> {g.title}</div>
            <div><span>{t('sg.genre').toUpperCase()}:</span> {g.genre.map((x, i) => <span key={x}><Link to={`/store/browse?genre=${encodeURIComponent(x)}`}>{x}</Link>{i < g.genre.length - 1 ? ', ' : ''}</span>)}</div>
            <div><span>{t('sg.dev').toUpperCase()}:</span> <Link to={`/store/browse?q=${encodeURIComponent(g.dev)}`}>{g.dev}</Link></div>
            <div><span>{t('sg.pub').toUpperCase()}:</span> <Link to={`/store/browse?q=${encodeURIComponent(g.publisher)}`}>{g.publisher}</Link></div>
            <div><span>{t('sg.release').toUpperCase()}:</span> {new Date(g.released).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <Link to={`/community?hub=${g.id}`} className="rail-link">{t('sg.hubvisit')}</Link>
          <Link to={`/store/browse?q=${encodeURIComponent(g.dev)}`} className="rail-link">More from {g.dev}</Link>
        </aside>
      </div>

      {similar.length > 0 && (<><h2>{t('sg.more')}</h2><div className="cards">{similar.map(s => (
        <Link key={s.id} to={`/store/${s.id}`} className="scard"><div className="scard-art"><Art game={s} kind="header" /></div><div className="scard-body"><div className="scard-title">{s.title}</div><Tags g={s} n={2} /><Price game={s} /></div></Link>))}</div></>)}
      <div className="muted small" style={{ margin: '20px 0 40px' }}>{fmt(priceOf(g))} · {g.dev}</div>
    </div>
    {achOpen && <AchievementsModal gameId={g.id} title={g.title} unlocked={store.owned.includes(g.id) ? Math.min(g.achievements, Math.floor((store.playtime[g.id] ?? 0) / 3)) : null} onClose={() => setAchOpen(false)} />}
    </div>
  )
})
