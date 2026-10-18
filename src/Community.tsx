import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact, fmt, priceOf, type Game } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Avatar, Modal } from './ui'
import './community.css'

const TABS = ['All', 'Screenshots', 'Artwork', 'Broadcasts', 'Videos', 'Workshop', 'News', 'Guides', 'Reviews'] as const
const HUB_TABS = ['All', 'Discussions', 'Screenshots', 'Artwork', 'Broadcasts', 'Videos', 'News', 'Guides', 'Reviews'] as const
type Tab = (typeof HUB_TABS)[number] | (typeof TABS)[number]
type Kind = 'Screenshots' | 'Artwork' | 'Videos' | 'Workshop' | 'Guides' | 'Reviews' | 'News' | 'Broadcasts' | 'Discussions'

const AUTHORS = ['Ravenfeather', 'plumbob_ace', 'Quillon', 'MellowMoth', 'ByteBaron', 'sunday_driver', 'Hexley', 'nightowl88', 'PaperTiger', 'Orbit9']
const TITLES: Record<Kind, string[]> = {
  Screenshots: ['Golden hour at the summit', 'My best run so far', 'Found a quiet corner', 'Unexpected sunrise', 'Photo mode is dangerous'],
  Artwork: ['Fan art: the long way home', 'Character study', 'Poster concept', 'Pixel redraw', 'Winter variant'],
  Videos: ['Full clear in under an hour', 'Hidden route showcase', 'Boss fight no-hit', 'Ten tips for new players'],
  Workshop: ['Colorblind-friendly palette', 'Bigger text pack', 'New starter loadout', 'Remastered soundtrack mix'],
  Guides: ['Simple progress map', 'Ranking every boss by difficulty', 'How to befriend the rarest creature', 'Efficient progression route', 'Settings worth changing'],
  Reviews: ['A near-perfect experience', 'Great, with caveats', 'Hard to put down', 'Worth it on sale'],
  News: ['Patch notes for this week', 'Developer diary: what is next', 'Community event announced', 'Roadmap update'],
  Broadcasts: ['Live: relaxing evening run', 'Live: speedrun attempts', 'Live: new player questions'],
  Discussions: ['Share your favorite moment', 'Is the second area worth the detour?', 'Tips for the hardest boss', 'Post your setup'],
}
const GUIDE_TXT = [
  'A simple map for game progress routing, with every optional area marked so you never miss a thing.',
  'This guide is dedicated solely to ranking all of the encounters. It is not a walkthrough or a strategy handbook, it is simply meant to rank how good or bad each one is.',
  'To befriend the rarest creature, equip the right charm first and follow the second route past the old gate. Come back after the next update for the full list.',
]
const REVIEW_TXT = [
  'I work in a nursing home. Most of my residents have trouble with their vision and tremors that mean they cannot keep up with their old hobbies. Yesterday I showed one of them this game.\n\nIt brought her so much joy. She lit up when she saw all the patterns and started comparing them against each other. It has inspired me to pick up my own hobby again.\n\nThank you, from the bottom of my heart.',
  'I do not think I have ever seen a better game of this kind. Polished and charming from the first minute, and I am only a few hours in. The pacing sags a little in the middle but the finish more than makes up for it.',
  'Easy to pick up and surprisingly deep. The art direction carries the whole thing, and the soundtrack is the kind you keep humming. Cannot recommend it enough for the price.',
]

interface Item { id: number; kind: Kind; game: Game; title: string; author: string; likes: number; comments: number; awards: number; ratings: number; stars: number; when: string; text: string; hrs: number; positive: boolean; helpful: number; funny: number }
const buildItems = (): Item[] => {
  const kinds: Kind[] = ['Reviews', 'Screenshots', 'Guides', 'Guides', 'Artwork', 'Videos', 'Workshop', 'News', 'Broadcasts', 'Discussions']
  return Array.from({ length: 72 }, (_, i) => {
    const kind = kinds[i % kinds.length], game = GAMES[(i * 7 + 3) % GAMES.length]
    return {
      id: i, kind, game, title: TITLES[kind][(i >> 1) % TITLES[kind].length], author: AUTHORS[(i * 5) % AUTHORS.length], likes: ((i * 193) % 4200) + 40,
      comments: (i * 7) % 90, awards: (i * 3) % 12, ratings: ((i * 37) % 300) + 12, stars: 3 + (i % 3) * 0.5 + 0.5, when: ['October 11', 'October 8', 'October 2', 'September 26'][i % 4],
      text: kind === 'Guides' ? GUIDE_TXT[i % 3] : REVIEW_TXT[i % 3], hrs: ((i * 17) % 120) + 3, positive: (i * 3) % 7 !== 0, helpful: ((i * 211) % 3000) + 20, funny: (i * 13) % 40,
    }
  })
}

const Stars = ({ n }: { n: number }) => <span className="stars" aria-label={`${n} stars`}>{[1, 2, 3, 4, 5].map(k => <i key={k} className={k <= Math.floor(n) ? 'on' : ''}>★</i>)}</span>
const Counts = ({ it }: { it: Item }) => <span className="counts"><span className="aw"><Icon name="star" size={13} /> {it.awards}</span><span className="cm"><Icon name="chat" size={14} /> {it.comments}</span></span>

const ReviewCard = ({ it, big = false }: { it: Item; big?: boolean }) => (
  <div className={`cc review ${big ? 'big' : ''}`}>
    <div className="rv-lines"><div>{compact(it.helpful)} people found this review helpful</div><div>{it.funny} people found this review funny <span className="award"><Icon name="star" size={14} /> {compact(it.awards * 12)}</span></div></div>
    <div className="verdict"><span className="thumbbox"><Icon name="thumbUp" size={26} /></span><div><div className="vd">{it.positive ? 'Recommended' : 'Not Recommended'}</div><div className="muted small">{it.hrs} hrs on record</div></div></div>
    <div className="posted">Posted: {it.when}</div>
    <div className={`rv-text ${big ? '' : 'clamp'}`}>{it.text.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}</div>
    <div className="cc-foot"><span>{it.game.title}</span><span className="cm"><Icon name="chat" size={14} /> {it.comments}</span></div>
  </div>
)
const ShotCard = ({ it }: { it: Item }) => (
  <div className="cc shot">
    <div className="shot-art"><Art game={it.game} kind={it.kind === 'Artwork' ? 'wide' : 'shot'} variant={it.id % 6} showTitle={it.kind !== 'Screenshots'} />
      {it.kind === 'Videos' && <span className="vplay"><Icon name="play" size={30} /></span>}{it.kind === 'Broadcasts' && <span className="live">LIVE</span>}</div>
    <div className="shot-cap">{it.title.toUpperCase()}</div>
    <div className="cc-foot"><span>{it.game.title}</span><Counts it={it} /></div>
  </div>
)
const GuideCard = ({ it }: { it: Item }) => (
  <div className="cc guide">
    <div className="g-title">{it.kind === 'Workshop' ? 'Workshop Item' : it.kind === 'Discussions' ? 'Discussion' : it.kind === 'News' ? 'News' : 'Guide'}</div>
    <div className="g-inner"><div className="g-thumb"><Art game={it.game} kind="icon" variant={it.id % 5} /></div><div className="g-name">{it.title}</div></div>
    <p className="g-desc">{it.text}</p>
    <div className="g-meta"><span><Stars n={it.stars} /> <span className="muted">{it.ratings} ratings</span></span><Counts it={it} /></div>
    <div className="g-author"><Avatar f={{ name: it.author, hue: it.id * 41, status: 'offline' }} size={26} ring={false} /><div><div>{it.author}</div><div className="muted tiny">View all {it.kind === 'Guides' ? 'guides' : 'content'}</div></div></div>
  </div>
)
const Card = ({ it, big }: { it: Item; big?: boolean }) =>
  it.kind === 'Reviews' ? <ReviewCard it={it} big={big} /> : ['Screenshots', 'Artwork', 'Videos', 'Broadcasts'].includes(it.kind) ? <ShotCard it={it} /> : <GuideCard it={it} />

/** The real "All" feed lays cards out in repeating rows: a big review beside two stacked shots, two guides, then three. */
const Mosaic = ({ items }: { items: Item[] }) => {
  const rows: React.ReactNode[] = []
  let i = 0, r = 0
  const take = (pred: (x: Item) => boolean) => { const k = items.findIndex((x, idx) => idx >= i && pred(x)); if (k < 0) return items[i++]; const [x] = items.splice(k, 1); items.splice(i, 0, x); return items[i++] }
  while (i < items.length && r < 12) {
    const p = r % 3
    if (p === 0) { const a = take(x => x.kind === 'Reviews'), b = take(x => x.kind === 'Screenshots'), c = take(x => x.kind === 'Artwork' || x.kind === 'Screenshots'); rows.push(<div className="mrow m1" key={r}>{a && <Card it={a} big />}<div className="stack">{b && <Card it={b} />}{c && <Card it={c} />}</div></div>) }
    else if (p === 1) { const a = take(x => x.kind === 'Guides'), b = take(x => x.kind === 'Guides' || x.kind === 'Workshop'); rows.push(<div className="mrow m2" key={r}>{a && <Card it={a} />}{b && <Card it={b} />}</div>) }
    else { const a = take(x => x.kind === 'News' || x.kind === 'Workshop'), b = take(x => x.kind === 'Discussions' || x.kind === 'Guides'), c = take(x => x.kind === 'Reviews'); rows.push(<div className="mrow m3" key={r}>{a && <Card it={a} />}{b && <Card it={b} />}{c && <Card it={c} />}</div>) }
    r++
  }
  return <>{rows}</>
}

export const Community = observer(() => {
  const [sp, setSp] = useSearchParams()
  const hub = Number(sp.get('hub') ?? 0)
  const hubGame = GAMES.find(g => g.id === hub)
  const tabs = hubGame ? HUB_TABS : TABS
  const tabParam = sp.get('tab') as Tab | null
  const tab: Tab = tabParam && (tabs as readonly string[]).includes(tabParam) ? tabParam : 'All'
  const [popular, setPopular] = useState(true)
  const [hubQ, setHubQ] = useState('')
  const [peopleQ, setPeopleQ] = useState('')
  const [shown, setShown] = useState(18)
  const [notFound, setNotFound] = useState<string | null>(null)
  const [about, setAbout] = useState(false)
  const all = useMemo(buildItems, [])

  const setParams = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n); setShown(18) }
  let items = all.filter(i => (tab === 'All' || i.kind === tab || (tab === 'Workshop' && i.kind === 'Workshop')) && (!hubGame || i.game.id === hubGame.id || i.id % 3 === 0))
  if (hubGame) items = items.map(i => ({ ...i, game: hubGame }))
  items = [...items].sort((a, b) => (popular ? b.likes - a.likes : b.id - a.id))

  const recentHubs = [...store.ownedGames].filter(g => store.lastPlayed[g.id]).sort((a, b) => (store.lastPlayed[b.id] ?? 0) - (store.lastPlayed[a.id] ?? 0)).slice(0, 3)
  const popularHubs = [...GAMES].sort((a, b) => b.reviews - a.reviews).slice(0, 4)
  const hubHits = hubQ.trim() ? GAMES.filter(g => g.title.toLowerCase().includes(hubQ.trim().toLowerCase())).slice(0, 5) : []
  const people = peopleQ.trim() ? store.friends.filter(f => f.name.toLowerCase().includes(peopleQ.trim().toLowerCase())) : []
  const playing = hubGame ? store.friends.filter(f => f.gameId === hubGame.id).length + (hubGame.reviews % 9000) : 0

  const feed = tab === 'All' && !hubGame ? <Mosaic items={[...items.slice(0, shown)]} /> : tab === 'All' ? <Mosaic items={[...items.slice(0, shown)]} />
    : <div className={`cm-grid ${['Screenshots', 'Artwork', 'Videos', 'Broadcasts'].includes(tab) ? 'tiles' : tab === 'Reviews' ? '' : 'two'}`}>{items.slice(0, shown).map(it => <Card key={it.id} it={it} />)}</div>

  return (
    <div className="community">
      <div className="cm-wrap">
        {hubGame ? (
          <>
            <div className="hub-top"><h1>{hubGame.title}</h1><Link to={`/store/${hubGame.id}`} className="storepage">Store Page</Link></div>
            <div className="cm-tabs hubtabs">{tabs.map(t => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setParams('tab', t === 'All' ? null : t)}>{t}</button>)}</div>
            <div className="hub-banner">
              <div className="hub-stats"><span className="ingame">{compact(playing)} In-Game</span> <span>{compact(Math.round(playing / 3))} in <u>Group Chat</u></span><span className="vs"><Icon name="grid" size={14} /> <u>View Stats</u></span></div>
              <div className="hub-main">
                <div className="hub-cap"><Art game={hubGame} kind="header" /></div>
                <div><p>{hubGame.blurb}</p>
                  <div className="hub-buy"><span className="hub-price">{hubGame.price === 0 ? 'Free' : fmt(priceOf(hubGame))}</span><Link to={`/store/${hubGame.id}`} className="visit">Visit the Store Page</Link>
                    <button className="link-btn" onClick={() => setParams('hub', null)}>All of the community</button></div></div>
              </div>
            </div>
            <div className="more-ways">MORE WAYS TO CONNECT:<div className="ways"><span /><span /><span /></div></div>
            <div className="popular-note">Most popular community and official content for the past week. <button className="link-btn" onClick={() => setAbout(true)}>(?)</button></div>
          </>
        ) : (
          <>
            <h1>Community Activity</h1><p className="cm-sub">Community and official content for all games and software on reSteam.</p>
            <div className="cm-panels">
              <div className="cm-panel cols2">
                <div>
                  <h4>YOUR RECENTLY PLAYED GAMES</h4>
                  {recentHubs.length === 0 && <div className="muted">Play a game and its hub will show up here.</div>}
                  {recentHubs.map(g => <Link key={g.id} to={`/community?hub=${g.id}`} className="hubrow"><Art game={g} kind="icon" className="hub-icon" /><div><div className="hn">{g.title}</div><div className="hl">{(g.id % 4) + 1} new guides this week</div></div></Link>)}
                </div>
                <div>
                  <h4>POPULAR HUBS</h4>
                  {popularHubs.map((g, i) => <Link key={g.id} to={`/community?hub=${g.id}`} className="hubrow"><Art game={g} kind="icon" className="hub-icon" /><div><div className="hn">{g.title}</div><div className="hl">{compact((g.reviews % 900) + 90 + i * 40)} new {['artwork', 'workshop items', 'screenshots', 'guides'][i]} this week</div></div></Link>)}
                </div>
              </div>
              <div className="cm-panel">
                <h4>FIND HUBS</h4>
                <div className="cm-search"><input placeholder="Search for products" value={hubQ} onChange={e => setHubQ(e.target.value)} aria-label="Search for products" /><Icon name="search" size={22} /></div>
                {hubHits.map(g => <Link key={g.id} to={`/community?hub=${g.id}`} className="hl-hit">{g.title}</Link>)}
                <h4 className="mt">FIND PEOPLE</h4>
                <form className="cm-search" onSubmit={e => { e.preventDefault(); setNotFound(people.length === 0 && peopleQ.trim() ? peopleQ.trim() : null) }}>
                  <input placeholder="Search for friends" value={peopleQ} onChange={e => { setPeopleQ(e.target.value); setNotFound(null) }} aria-label="Search for friends" /><Icon name="search" size={22} />
                </form>
                {people.map(f => <button key={f.id} className="hl-hit" onClick={() => store.openChat(f.id)}><Avatar f={f} size={22} /> {f.name}</button>)}
                {notFound && <div className="small">No one named "{notFound}". <button className="link-btn" onClick={async () => { const e = await store.addFriend(notFound); store.toast(e ?? `Friend request sent to ${notFound}`) }}>Send a friend request</button></div>}
              </div>
            </div>
            <div className="cm-tabs">
              {tabs.map(t => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setParams('tab', t === 'All' ? null : t)}>{t}</button>)}
              <span className="grow" />
              <span className="muted viewing">Viewing</span>
              <button className={`seg ${popular ? 'on' : ''}`} onClick={() => setPopular(true)}>MOST POPULAR</button>
              <button className={`seg ${!popular ? 'on' : ''}`} onClick={() => setPopular(false)}>MOST RECENT</button>
            </div>
          </>
        )}
        {hubGame && <div className="cm-tabs viewrow"><span className="grow" /><span className="muted viewing">Viewing</span>
          <button className={`seg ${popular ? 'on' : ''}`} onClick={() => setPopular(true)}>MOST POPULAR</button><button className={`seg ${!popular ? 'on' : ''}`} onClick={() => setPopular(false)}>MOST RECENT</button></div>}

        {feed}
        {items.length === 0 && <p className="muted">Nothing here yet.</p>}
        {shown < items.length && <div className="cm-more"><button className="btn" onClick={() => setShown(shown + 18)}>Show more</button></div>}
        <div className="cm-foot muted small">reSteam is a fan-made UI study. Content on this page is generated for demonstration.</div>
      </div>
      {about && <Modal title="Community content" onClose={() => setAbout(false)}><p>Everything shown here is generated for demonstration. There are no real posts or users.</p></Modal>}
    </div>
  )
})
