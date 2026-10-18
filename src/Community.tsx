import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact, type Game } from './data'
import { store } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Avatar, Modal } from './ui'
import './community.css'

const TABS = ['All', 'Screenshots', 'Artwork', 'Broadcasts', 'Videos', 'Workshop', 'News', 'Guides', 'Reviews'] as const
type Tab = (typeof TABS)[number]
const KINDS: Exclude<Tab, 'All'>[] = ['Screenshots', 'Artwork', 'Videos', 'Workshop', 'Guides', 'Reviews', 'News', 'Broadcasts']
const AUTHORS = ['Ravenfeather', 'plumbob_ace', 'Quillon', 'MellowMoth', 'ByteBaron', 'sunday_driver', 'Hexley', 'nightowl88']
const TITLES: Record<string, string[]> = {
  Screenshots: ['Golden hour at the summit', 'My best run so far', 'Found a quiet corner', 'Unexpected sunrise'],
  Artwork: ['Fan art: the long way home', 'Character study', 'Poster concept', 'Pixel redraw'],
  Videos: ['Full clear in under an hour', 'Hidden route showcase', 'Boss fight no-hit', 'Ten tips for new players'],
  Workshop: ['Colorblind-friendly palette', 'Bigger text pack', 'New starter loadout', 'Remastered soundtrack mix'],
  Guides: ['Beginner guide: first five hours', 'Every secret, explained', 'Efficient progression route', 'Settings worth changing'],
  Reviews: ['A near-perfect experience', 'Great, with caveats', 'Hard to put down', 'Worth it on sale'],
  News: ['Patch notes for this week', 'Developer diary: what is next', 'Community event announced', 'Roadmap update'],
  Broadcasts: ['Live: relaxing evening run', 'Live: speedrun attempts', 'Live: new player questions', 'Live: building the perfect loadout'],
}
const REVIEW_TXT = ['I do not think I have ever seen a better game of this kind. Polished and charming, and I am only a few hours in.', 'Looks gorgeous and plays smoothly. Pacing sags a little in the middle, but the finish more than makes up for it.', 'Easy to pick up and surprisingly deep. Cannot recommend it enough for the price.']

interface Item { id: number; kind: Exclude<Tab, 'All'>; game: Game; title: string; author: string; likes: number; when: string; text: string; hrs: number; positive: boolean; helpful: number; funny: number }

const buildItems = (): Item[] => Array.from({ length: 48 }, (_, i) => {
  const kind = KINDS[i % KINDS.length]
  const game = GAMES[(i * 7 + 3) % GAMES.length]
  return {
    id: i, kind, game, title: TITLES[kind][(i >> 1) % 4], author: AUTHORS[(i * 5) % AUTHORS.length], likes: ((i * 193) % 4200) + 40,
    when: ['October 10', 'October 8', 'October 2', 'September 26', 'September 20'][i % 5], text: REVIEW_TXT[i % 3], hrs: ((i * 17) % 120) + 3,
    positive: (i * 3) % 7 !== 0, helpful: ((i * 211) % 900) + 20, funny: (i * 13) % 40,
  }
})

const Card = ({ it }: { it: Item }) => {
  if (it.kind === 'Reviews') {
    return (
      <div className="cm-review">
        <div className="cm-rv-art"><Art game={it.game} kind="wide" variant={it.id % 3} showTitle /></div>
        <div className="cm-rv-side">
          <div className="muted small">{compact(it.helpful)} people found this review helpful</div>
          <div className="muted small">{it.funny} people found this review funny <span className="award"><Icon name="star" size={16} /> {Math.round(it.helpful / 12)}</span></div>
          <div className="cm-verdict"><span className="thumbbox"><Icon name="thumbUp" size={26} /></span><div><div className="vd">{it.positive ? 'Recommended' : 'Not Recommended'}</div><div className="muted small">{it.hrs} hrs on record</div></div></div>
          <div className="muted small">Posted: {it.when}</div>
          <p>{it.text}</p>
        </div>
      </div>
    )
  }
  const wide = it.kind === 'News' || it.kind === 'Guides'
  return (
    <div className={`cm-card ${wide ? 'row' : ''}`}>
      <div className="cm-art"><Art game={it.game} kind={it.kind === 'Artwork' ? 'capsule' : 'shot'} variant={it.id % 5} showTitle={it.kind !== 'Screenshots'} />
        {it.kind === 'Videos' && <span className="cm-play"><Icon name="play" size={34} /></span>}
        {it.kind === 'Broadcasts' && <span className="cm-live">LIVE</span>}</div>
      <div className="cm-body">
        <div className="cm-title">{it.title}</div>
        <div className="muted small">{it.game.title} · by {it.author}</div>
        <div className="muted small">{it.kind === 'Broadcasts' ? `${it.likes % 400} viewers` : `${compact(it.likes)} likes`} · {it.when}</div>
        {wide && <p className="muted">{it.text}</p>}
      </div>
    </div>
  )
}

export const Community = observer(() => {
  const [sp, setSp] = useSearchParams()
  const hub = Number(sp.get('hub') ?? 0)
  const tabParam = sp.get('tab') as Tab | null
  const tab: Tab = tabParam && (TABS as readonly string[]).includes(tabParam) ? tabParam : 'All'
  const [popular, setPopular] = useState(true)
  const [hubQ, setHubQ] = useState('')
  const [peopleQ, setPeopleQ] = useState('')
  const [shown, setShown] = useState(12)
  const [notFound, setNotFound] = useState<string | null>(null)
  const all = useMemo(buildItems, [])
  const hubGame = GAMES.find(g => g.id === hub)

  const setParams = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n); setShown(12) }
  let items = all.filter(i => (tab === 'All' || i.kind === tab) && (!hubGame || i.game.id === hubGame.id || i.id % 4 === 0))
  if (hubGame) items = items.map(i => ({ ...i, game: hubGame }))
  items = [...items].sort((a, b) => popular ? b.likes - a.likes : b.id - a.id)

  const recentHubs = [...store.ownedGames].filter(g => store.lastPlayed[g.id]).sort((a, b) => (store.lastPlayed[b.id] ?? 0) - (store.lastPlayed[a.id] ?? 0)).slice(0, 3)
  const popularHubs = [...GAMES].sort((a, b) => b.reviews - a.reviews).slice(0, 4)
  const hubHits = hubQ.trim() ? GAMES.filter(g => g.title.toLowerCase().includes(hubQ.trim().toLowerCase())).slice(0, 5) : []
  const people = peopleQ.trim() ? store.friends.filter(f => f.name.toLowerCase().includes(peopleQ.trim().toLowerCase())) : []

  return (
    <div className="community">
      <div className="cm-wrap">
        {hubGame ? (
          <div className="hub-head">
            <div className="hub-art"><Art game={hubGame} kind="hero" /></div>
            <div><h1>{hubGame.title} Community Hub</h1><div className="muted">{compact(hubGame.reviews)} members · <Link to={`/store/${hubGame.id}`}>Store page</Link> · <button className="link-btn" onClick={() => setParams('hub', null)}>All of the community</button></div></div>
          </div>
        ) : (
          <><h1>Community Activity</h1><p className="cm-sub">Community and official content for all games and software on reSteam.</p></>
        )}

        {!hubGame && (
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
        )}

        <div className="cm-tabs">
          {TABS.map(t => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setParams('tab', t === 'All' ? null : t)}>{t}</button>)}
          <span className="grow" />
          <span className="muted viewing">Viewing</span>
          <button className={`seg ${popular ? 'on' : ''}`} onClick={() => setPopular(true)}>MOST POPULAR</button>
          <button className={`seg ${!popular ? 'on' : ''}`} onClick={() => setPopular(false)}>MOST RECENT</button>
        </div>

        <div className={`cm-grid ${tab === 'Reviews' || tab === 'All' ? '' : 'tiles'}`}>
          {items.slice(0, shown).map(it => <Card key={it.id} it={it} />)}
          {items.length === 0 && <p className="muted">Nothing here yet.</p>}
        </div>
        {shown < items.length && <div className="cm-more"><button className="btn" onClick={() => setShown(shown + 12)}>Show more</button></div>}
        <div className="cm-foot muted small">reSteam is a fan-made UI study. Content on this page is generated for demonstration. <PrivacyLink /></div>
      </div>
    </div>
  )
})

const PrivacyLink = () => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="link-btn small" onClick={() => setOpen(true)}>About this project</button>
      {open && <Modal title="About reSteam" onClose={() => setOpen(false)}><p>reSteam is an unofficial, educational recreation of a desktop game-store client. It contains no third-party code or artwork, and all games, people and reviews are fictional.</p></Modal>}
    </>
  )
}
