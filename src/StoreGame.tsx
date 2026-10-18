import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact, fmt, priceOf, reviewLabel, type Game } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Price } from './ui'
import { reviewClass, Tags } from './StorePages'

const NAMES = ['Ravenfeather', 'plumbob_ace', 'Quillon', 'MellowMoth', 'ByteBaron', 'sunday_driver', 'Hexley', 'nightowl88', 'PaperTiger', 'Orbit9']
const POS = ['Easily one of the best games I have played this year. Polished, charming and respects your time.', 'The art direction and soundtrack carry this. I kept finding small details worth stopping for.', 'Plays smoothly and the difficulty curve feels fair. Looking forward to whatever the developers do next.', 'I did not expect to put this many hours in. Great value for the price.']
const NEG = ['Great ideas, but the pacing drags in the middle and I never felt fully hooked.', 'Looks good, yet the controls need work. Hoping a patch smooths things out.']

const reviewsFor = (g: Game) => Array.from({ length: 4 }, (_, i) => {
  const positive = (g.id * 7 + i * 13) % 100 < g.rating
  return {
    name: NAMES[(g.id + i * 3) % NAMES.length], positive, hrs: ((g.id * 11 + i * 29) % 90) + 2,
    text: (positive ? POS : NEG)[(g.id + i) % (positive ? POS.length : NEG.length)], helpful: ((g.id * 31 + i * 17) % 700) + 12,
    when: ['October 10', 'September 28', 'September 3', 'August 17'][i],
  }
})

const reqs = (g: Game) => {
  const heavy = g.sizeGb > 30, mid = g.sizeGb > 8
  return {
    min: { OS: 'Windows 10 64-bit or macOS 12', Processor: heavy ? '6-core 3.0 GHz' : mid ? 'Quad-core 2.6 GHz' : 'Dual-core 2.0 GHz', Memory: heavy ? '12 GB RAM' : mid ? '8 GB RAM' : '4 GB RAM', Graphics: heavy ? '4 GB VRAM class' : mid ? '2 GB VRAM class' : 'Integrated graphics', Storage: `${Math.ceil(g.sizeGb)} GB available space` },
    rec: { OS: 'Windows 11 64-bit or macOS 13', Processor: heavy ? '8-core 3.6 GHz' : 'Quad-core 3.2 GHz', Memory: heavy ? '16 GB RAM' : '8 GB RAM', Graphics: heavy ? '8 GB VRAM class' : '4 GB VRAM class', Storage: `${Math.ceil(g.sizeGb)} GB available space (SSD)` },
  }
}

const Media = ({ g }: { g: Game }) => {
  const [i, setI] = useState(0)
  const thumbs = [0, 1, 2, 3, 4, 5, 6]
  return (
    <div className="media">
      <div className="media-main">
        <Art game={g} kind="shot" variant={i} showTitle={i === 0} />
        {i < 2 && <div className="play-over"><Icon name="play" size={54} /></div>}
        <button className="m-arrow l" onClick={() => setI((i + thumbs.length - 1) % thumbs.length)} aria-label="Previous"><Icon name="chevronLeft" size={30} /></button>
        <button className="m-arrow r" onClick={() => setI((i + 1) % thumbs.length)} aria-label="Next"><Icon name="chevronRight" size={30} /></button>
      </div>
      <div className="thumbs">{thumbs.map(n => (
        <button key={n} className={`thumb ${n === i ? 'on' : ''}`} onClick={() => setI(n)} aria-label={`Media ${n + 1}`}>
          <Art game={g} kind="shot" variant={n} showTitle={false} />{n < 2 && <span className="thumb-play"><Icon name="play" size={20} /></span>}
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
  const [follow, setFollow] = useState(false)
  useEffect(() => { if (g) store.view(g.id) }, [g])
  if (!g) return <div className="container"><h1>This item is not available.</h1><Link to="/store">Back to the store</Link></div>

  const owned = store.owned.includes(g.id)
  const inCart = store.cart.includes(g.id)
  const wished = store.wishlist.includes(g.id)
  const installed = store.installed.includes(g.id)
  const queued = store.queue.some(d => d.id === g.id)
  const recent = Math.min(99, Math.max(30, g.rating + ((g.id * 3) % 7) - 3))
  const rq = reqs(g)
  const similar = GAMES.filter(x => x.id !== g.id && x.tags.some(t => g.tags.includes(t))).slice(0, 4)
  const friends = store.friends.filter(f => f.gameId === g.id)

  return (
    <div className="container sgame">
      <div className="crumbs"><Link to="/store/browse">All Games</Link> &gt; <Link to={`/store/browse?genre=${encodeURIComponent(g.genre[0])}`}>{g.genre[0]} Games</Link> &gt; <span>{g.title}</span></div>
      <div className="sg-title"><h1>{g.title}</h1><Link to={`/community?hub=${g.id}`} className="hubbtn">Community Hub</Link></div>

      <div className="sg-top">
        <Media g={g} />
        <div className="sg-side">
          <div className="sg-cap"><Art game={g} kind="header" /></div>
          <p className="sg-desc">{g.blurb}</p>
          <dl className="sg-kv">
            <dt>Recent reviews:</dt><dd><span className={reviewClass(recent)}>{reviewLabel(recent)}</span> <span className="muted">({compact(Math.round(g.reviews / 24))})</span></dd>
            <dt>All reviews:</dt><dd><span className={reviewClass(g.rating)}>{reviewLabel(g.rating)}</span> <span className="muted">({compact(g.reviews)})</span></dd>
            <dt>Release date:</dt><dd>{new Date(g.released).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
            <dt>Developer:</dt><dd><Link to={`/store/browse?q=${encodeURIComponent(g.dev)}`}>{g.dev}</Link></dd>
            <dt>Publisher:</dt><dd><Link to={`/store/browse?q=${encodeURIComponent(g.publisher)}`}>{g.publisher}</Link></dd>
          </dl>
          <div className="sg-tags"><div className="muted small">Popular user-defined tags for this product:</div>
            <div className="tagrow">{(allTags ? g.tags : g.tags.slice(0, 5)).map(t => <Link key={t} to={`/store/browse?tag=${encodeURIComponent(t)}`} className="tagchip">{t}</Link>)}
              <button className="tagchip plus" onClick={() => setAllTags(!allTags)} aria-label="Toggle tags">{allTags ? '–' : '+'}</button></div></div>
        </div>
      </div>

      <div className="sg-actions">
        <button className={`btn ${follow ? 'blue' : ''}`} onClick={() => { setFollow(!follow); store.toast(follow ? `Unfollowed ${g.title}` : `Following ${g.title}`) }}>{follow ? 'Following' : 'Follow'}</button>
        <button className="btn" onClick={() => store.toast(`${g.title} will no longer be recommended`)}>Ignore</button>
        {friends.length > 0 && <span className="muted small">{friends.map(f => f.name).join(', ')} playing now</span>}
      </div>

      <div className="buybox">
        <h2 className="bb-title">{g.price === 0 ? `Play ${g.title}` : `Buy ${g.title}`}</h2>
        <div className="bb-row">
          <Price game={g} big />
          {owned ? (
            installed ? <button className="btn play" onClick={() => nav(`/library/${g.id}`)}>Play in Library</button>
              : queued ? <Link to="/downloads" className="btn blue">Installing…</Link>
              : <button className="btn blue" onClick={() => { store.install(g.id); nav('/downloads') }}><Icon name="download" size={18} /> Install</button>
          ) : g.price === 0 ? <button className="btn green" onClick={() => { store.claimFree(g.id); store.toast(`${g.title} was added to your library`) }}>Play Game</button>
            : inCart ? <Link to="/cart" className="btn green">In cart — View cart</Link>
            : <button className="btn green" onClick={() => store.addToCart(g.id)}>Add to Cart</button>}
          {!owned && <button className={`btn ${wished ? 'blue' : ''}`} onClick={() => store.toggleWishlist(g.id)}>{wished ? 'On Wishlist ✓' : 'Add to your wishlist'}</button>}
        </div>
        {g.discount > 0 && <div className="bb-sale">Offer ends in a few days. {g.discount}% off the regular price.</div>}
      </div>

      <div className="sg-cols">
        <div>
          <h2>About this game</h2>
          <div className="about">
            <p>{g.blurb}</p>
            <p>{g.title} is a {g.genre.join(' / ').toLowerCase()} game from {g.dev}. It has {g.achievements} achievements and takes up about {g.sizeGb.toFixed(1)} GB once installed.</p>
            <p>Tags players use most: {g.tags.join(', ')}.</p>
          </div>
          <h2>System requirements</h2>
          <div className="reqs">
            {([['Minimum', rq.min], ['Recommended', rq.rec]] as const).map(([label, r]) => (
              <div key={label}><h3>{label}</h3><dl className="sg-kv">{Object.entries(r).map(([k, v]) => <div key={k} className="kvr"><dt>{k}:</dt><dd>{v}</dd></div>)}</dl></div>
            ))}
          </div>
        </div>
        <aside>
          <h2>Customer reviews</h2>
          <div className="rv-sum">
            <div><span className="muted small">Recent</span><br /><span className={reviewClass(recent)}>{reviewLabel(recent)}</span></div>
            <div><span className="muted small">Overall</span><br /><span className={reviewClass(g.rating)}>{reviewLabel(g.rating)}</span></div>
          </div>
          <div className="rv-bar" title={`${g.rating}% positive`}><span style={{ width: `${g.rating}%` }} /></div>
          <div className="muted small">{g.rating}% of the {compact(g.reviews)} reviews are positive.</div>
        </aside>
      </div>

      <h2>Reviews</h2>
      <div className="rv-list">
        {reviewsFor(g).map(r => (
          <div className="rv-card" key={r.name}>
            <div className="rv-head"><span className="rv-thumb"><Icon name="thumbUp" size={22} /></span><div><div className="rv-verdict">{r.positive ? 'Recommended' : 'Not Recommended'}</div><div className="muted small">{r.hrs} hrs on record</div></div></div>
            <div className="muted small">Posted: {r.when}</div>
            <p>{r.text}</p>
            <div className="muted small">{r.helpful} people found this review helpful · by {r.name}</div>
          </div>
        ))}
      </div>

      {similar.length > 0 && (<><h2>More like this</h2><div className="cards">{similar.map(s => (
        <Link key={s.id} to={`/store/${s.id}`} className="scard"><div className="scard-art"><Art game={s} kind="header" /></div><div className="scard-body"><div className="scard-title">{s.title}</div><Tags g={s} n={2} /><Price game={s} /></div></Link>))}</div></>)}
      <div className="muted small" style={{ margin: '20px 0 40px' }}>{fmt(priceOf(g))} · {g.dev}</div>
    </div>
  )
})
