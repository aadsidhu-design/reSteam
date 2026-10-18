import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact, fmt, priceOf, reviewLabel, type Game } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Price } from './ui'
import { Plats, reviewClass, Tags } from './StorePages'

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

      <div className="sg-signed">
        <div className="sg-btns">
          <button className={`btn ${wished ? 'blue' : ''}`} onClick={() => store.toggleWishlist(g.id)} disabled={owned}>{wished ? 'On Wishlist ✓' : 'Add to your wishlist'}</button>
          <button className={`btn ${store.followed.includes(g.id) ? 'blue' : ''}`} onClick={() => { store.toggleFollow(g.id); store.toast(store.followed.includes(g.id) ? `Following ${g.title}` : `Unfollowed ${g.title}`) }}>{store.followed.includes(g.id) ? 'Following ✓' : 'Follow'}</button>
          <button className={`btn ${store.ignored.includes(g.id) ? 'red' : ''}`} onClick={() => { store.toggleIgnore(g.id); store.toast(store.ignored.includes(g.id) ? `${g.title} is now ignored and will be hidden from the store` : `${g.title} is no longer ignored`) }}>{store.ignored.includes(g.id) ? 'Ignored ✓' : 'Ignore'}</button>
          {friends.length > 0 && <span className="muted small">{friends.map(f => f.name).join(', ')} playing now</span>}
        </div>
        <button className="sharebtn" aria-label="Copy link" title="Copy link" onClick={() => { void navigator.clipboard?.writeText(location.href); store.toast('Link copied') }}><Icon name="share" size={20} /></button>
      </div>

      <div className="sg-body">
        <div className="sg-main">
          <div className="buybox">
            <div className="bb-top"><h2 className="bb-title">{g.price === 0 ? `Play ${g.title}` : `Buy ${g.title}`}</h2><Plats /></div>
            <div className="bb-actions">
              {g.discount > 0 && <span className="bb-pct">-{g.discount}%</span>}
              <span className="bb-price">{g.discount > 0 && <s>{fmt(g.price)}</s>}<b>{fmt(priceOf(g))}</b></span>
              {owned ? (
                installed ? <button className="btn play" onClick={() => nav(`/library/${g.id}`)}>Play in Library</button>
                  : queued ? <Link to="/downloads" className="btn blue">Installing…</Link>
                  : <button className="btn blue" onClick={() => { store.install(g.id); nav('/downloads') }}><Icon name="download" size={18} /> Install</button>
              ) : g.price === 0 ? <button className="btn addcart" onClick={() => { store.claimFree(g.id); store.toast(`${g.title} was added to your library`) }}>Play Game</button>
                : inCart ? <Link to="/cart" className="btn addcart">In cart — View cart</Link>
                : <button className="btn addcart" onClick={() => store.addToCart(g.id)}>Add to Cart</button>}
            </div>
          </div>

          <div className="dlc">
            <div className="dlc-head"><h3>Content For This Game</h3><button className="seebtn" onClick={() => store.toast('Extra content is not part of the demo catalog')}>Browse all (2)</button></div>
            <div className="dlc-row"><span>{g.title} - Official Soundtrack</span><b>$9.99</b></div>
            <div className="dlc-row"><span>{g.title} - Expansion Pack</span><b>$4.99</b></div>
            <div className="dlc-foot"><span className="bb-price"><b>$14.98</b></span><button className="btn addcart" onClick={() => store.toast('Extra content is not part of the demo catalog')}>Add all DLC to Cart</button></div>
          </div>

          <h2 className="ul">Reviews</h2>
          <div className="critic">
            <p>“{['A deep dive into a rich, carefully made world.', 'Charming, polished and impossible to put down.', 'A confident, memorable take on the genre.'][g.id % 3]}”<br /><b>{[9, 10, 8][g.id % 3]}/10 – {['Pixel Gazette', 'Daily Joystick', 'The Play Report'][g.id % 3]}</b></p>
            <p>“{['Worth every minute, and then some.', 'Easily one of the standout releases of the year.'][g.id % 2]}”<br /><b>{[92, 88][g.id % 2]}/100 – {['Indie Ledger', 'Frame Rate'][g.id % 2]}</b></p>
          </div>

          <h2 className="ul">About This Game</h2>
          <div className="about">
            <h4>{g.title} {['expands with free content', 'gets a major update', 'is ready for new players'][g.id % 3]}</h4>
            <div className="about-img"><Art game={g} kind="wide" variant={3} showTitle={false} /></div>
            <p><b>Overview</b> – {g.blurb}</p>
            <p>{g.title} is a {g.genre.join(' / ').toLowerCase()} game from {g.dev}. It has {g.achievements} achievements and takes up about {g.sizeGb.toFixed(1)} GB once installed.</p>
            <div className="about-img"><Art game={g} kind="wide" variant={5} showTitle={false} /></div>
            <p><b>Features</b> – {g.tags.join(', ')}.</p>
          </div>

          <h2 className="ul">System requirements</h2>
          <div className="reqs">
            {([['Minimum', rq.min], ['Recommended', rq.rec]] as const).map(([label, r]) => (
              <div key={label}><h3>{label}</h3><dl className="sg-kv">{Object.entries(r).map(([k, v]) => <div key={k} className="kvr"><dt>{k}:</dt><dd>{v}</dd></div>)}</dl></div>
            ))}
          </div>

          <h2 className="ul">Customer reviews</h2>
          <div className="rv-sum">
            <div><span className="muted small">Recent</span><br /><span className={reviewClass(recent)}>{reviewLabel(recent)}</span></div>
            <div><span className="muted small">Overall</span><br /><span className={reviewClass(g.rating)}>{reviewLabel(g.rating)}</span></div>
          </div>
          <div className="rv-bar" title={`${g.rating}% positive`}><span style={{ width: `${g.rating}%` }} /></div>
          <div className="muted small" style={{ marginBottom: 14 }}>{g.rating}% of the {compact(g.reviews)} reviews are positive.</div>
          <div className="rv-list one">
            {reviewsFor(g).map(r => (
              <div className="rv-card" key={r.name}>
                <div className="rv-head"><span className="rv-thumb"><Icon name="thumbUp" size={22} /></span><div><div className="rv-verdict">{r.positive ? 'Recommended' : 'Not Recommended'}</div><div className="muted small">{r.hrs} hrs on record</div></div></div>
                <div className="muted small">Posted: {r.when}</div>
                <p>{r.text}</p>
                <div className="muted small">{r.helpful} people found this review helpful · by {r.name}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="sg-rail">
          <div className="rail-box feats">
            {[g.tags.includes('Multiplayer') ? 'Multi-player' : 'Single-player', 'Achievements', 'Cloud saves', 'Remote play on phone', 'Family sharing'].map((f, i) => <a key={f} className="feat-row" onClick={() => store.toast(`${f} is shown for illustration`)}><span className="fi">{['●', '✱', '☁', '▭', '☷'][i]}</span>{f}</a>)}
            <div className="muted small ctrl">Full controller support</div>
            <a className="feat-row" onClick={() => store.toast('Illustration only')}><span className="fi">◉</span>Gamepad controllers</a>
          </div>
          <div className="rail-box">
            <div className="muted small">Languages:</div>
            <table className="langs"><thead><tr><th /><th>Interface</th><th>Full Audio</th><th>Subtitles</th></tr></thead>
              <tbody>{['English', 'French', 'German', 'Spanish', 'Korean'].map(l => <tr key={l}><td>{l}</td><td>✔</td><td>{l === 'English' || g.id % 2 ? '✔' : ''}</td><td>✔</td></tr>)}</tbody></table>
            <a className="link-btn small" onClick={() => store.toast('All 11 languages are shown for illustration')}>See all 11 supported languages</a>
          </div>
          <h2 className="rail-h">Handheld compatibility</h2>
          <div className="rail-box compat"><span className={`vbadge ${g.sizeGb <= 10 ? 'ok' : 'pl'}`}>{g.sizeGb <= 10 ? '✔' : '●'}</span><span className="grow">{g.sizeGb <= 10 ? 'Verified' : 'Playable'}</span><button className="btn bright small" onClick={() => store.toast('Estimated from install size in this demo')}>Learn more</button></div>
          <div className="rail-box age"><div className="agebox"><b>{g.tags.includes('Horror') ? '17+' : g.tags.includes('Casual') || g.tags.includes('Cute') ? 'E' : '10+'}</b></div>
            <div><div>{g.tags.includes('Horror') ? 'Intense Violence' : 'Fantasy Violence'}</div><div className="muted">Mild Blood</div></div><div className="muted small agefoot">Age rating for: reRated</div></div>
          <div className="rail-box"><div className="muted small">Achievements</div>
            <div className="ach-tiles">{[0, 1, 2, 3].map(n => <div key={n} className="ach-tile"><Art game={g} kind="icon" variant={n} /></div>)}<Link to={`/library/${g.id}`} className="ach-more">View all<br />{g.achievements}</Link></div></div>
          <div className="rail-box details">
            <div><span>TITLE:</span> {g.title}</div>
            <div><span>GENRE:</span> {g.genre.map((x, i) => <span key={x}><Link to={`/store/browse?genre=${encodeURIComponent(x)}`}>{x}</Link>{i < g.genre.length - 1 ? ', ' : ''}</span>)}</div>
            <div><span>DEVELOPER:</span> <Link to={`/store/browse?q=${encodeURIComponent(g.dev)}`}>{g.dev}</Link></div>
            <div><span>PUBLISHER:</span> <Link to={`/store/browse?q=${encodeURIComponent(g.publisher)}`}>{g.publisher}</Link></div>
            <div><span>RELEASE DATE:</span> {new Date(g.released).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          </div>
          <Link to={`/community?hub=${g.id}`} className="rail-link">Visit the community hub</Link>
          <Link to={`/store/browse?q=${encodeURIComponent(g.dev)}`} className="rail-link">More from {g.dev}</Link>
        </aside>
      </div>

      {similar.length > 0 && (<><h2>More like this</h2><div className="cards">{similar.map(s => (
        <Link key={s.id} to={`/store/${s.id}`} className="scard"><div className="scard-art"><Art game={s} kind="header" /></div><div className="scard-body"><div className="scard-title">{s.title}</div><Tags g={s} n={2} /><Price game={s} /></div></Link>))}</div></>)}
      <div className="muted small" style={{ margin: '20px 0 40px' }}>{fmt(priceOf(g))} · {g.dev}</div>
    </div>
  )
})
