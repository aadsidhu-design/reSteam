import { useCallback, useEffect, useState } from 'react'
import { t } from './i18n'
import { Link, useSearchParams } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { GAMES, compact, fmt, priceOf, type Game } from './data'
import { api, call, store, type Person } from './store'
import { Art } from './art'
import { Icon } from './icons'
import { Avatar, Loading, Modal, ago, hours } from './ui'
import { ReviewCard, type Review } from './Reviews'
import './community.css'

type Kind = 'discussion' | 'guide'
interface Post { id: number; gameId: number; kind: Kind; title: string; body: string; at: number; username: string; name: string; replies: number; votes: number; mine: boolean }
interface Reply { id: number; body: string; at: number; username: string; name: string }
interface NewsRow { id: number; title: string; body: string; at: number; author: string }
interface FeedItem { type: 'review' | 'discussion' | 'guide' | 'news'; at: number; score: number; item: Review | Post | NewsRow }
interface Hub { gameId: number; posts: number; guides: number; reviews: number; playing: number; owners: number }

const TABS = ['All', 'Discussions', 'Guides', 'Reviews', 'News'] as const
const TAB_KEY: Record<string, string> = { All: 'comm.all', Discussions: 'comm.discussions', Guides: 'comm.guides', Reviews: 'comm.reviews', News: 'comm.news' }
type Tab = (typeof TABS)[number]
const gameOf = (id: number) => GAMES.find(g => g.id === id)

const PostCard = ({ p, onOpen, showGame }: { p: Post; onOpen: () => void; showGame?: boolean }) => {
  const g = gameOf(p.gameId)
  return (
    <div className="cc guide" role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen() }}>
      <div className="g-title">{p.kind === 'guide' ? 'Guide' : 'Discussion'}</div>
      <div className="g-inner">{g && <div className="g-thumb"><Art game={g} kind="icon" /></div>}<div className="g-name">{p.title}</div></div>
      <p className="g-desc">{p.body.length > 180 ? `${p.body.slice(0, 180)}…` : p.body}</p>
      <div className="g-meta"><span className="muted">{ago(p.at)}</span><span className="counts"><span className="aw"><Icon name="thumbUp" size={13} /> {p.votes}</span><span className="cm"><Icon name="chat" size={14} /> {p.replies}</span></span></div>
      <div className="g-author"><Avatar f={{ name: p.name }} size={26} ring={false} /><div><div>{p.name}</div>{showGame && g && <div className="muted tiny">{g.title}</div>}</div></div>
    </div>
  )
}

/** Review card in the community feed (same data as the store page, with the game named). */
const FeedReview = observer(({ r }: { r: Review }) => <div className="cc-review"><ReviewCard r={r} game={gameOf(r.gameId)} /></div>)

const NewPost = observer(({ g, kind, onClose, onDone }: { g: Game; kind: Kind; onClose: () => void; onDone: (id: number) => void }) => {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <Modal title={kind === 'guide' ? `Write a guide for ${g.title}` : `Start a discussion in ${g.title}`} onClose={onClose} width={560}>
      <form onSubmit={async e => {
        e.preventDefault(); setBusy(true)
        const { data, error } = await call<{ id: number }>('POST', `/games/${g.id}/posts`, { kind, title, body })
        setBusy(false)
        if (error || !data) setErr(error ?? 'Could not post'); else onDone(data.id)
      }}>
        <input className="input" autoFocus placeholder="Title" maxLength={120} value={title} onChange={e => { setTitle(e.target.value); setErr('') }} />
        <textarea className="input" rows={8} style={{ marginTop: 10 }} placeholder={kind === 'guide' ? 'Explain what you know. Guides can only be written by owners of the game.' : 'What do you want to talk about?'} maxLength={10000} value={body} onChange={e => { setBody(e.target.value); setErr('') }} />
        {err && <div className="err">{err}</div>}
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn blue" disabled={busy || title.trim().length < 3 || body.trim().length < 10}>{t('cm.post')}</button></div>
      </form>
    </Modal>
  )
})

const PostView = observer(({ id, onBack }: { id: number; onBack: () => void }) => {
  const [data, setData] = useState<{ post: Post; replies: Reply[] } | null | 'gone'>(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const load = useCallback(async () => { const r = await api<{ post: Post; replies: Reply[] }>('GET', `/posts/${id}`); setData(r ?? 'gone') }, [id])
  useEffect(() => { void load() }, [load])
  if (data === null) return <Loading />
  if (data === 'gone') return <div><button className="link-btn" onClick={onBack}>← Back</button><p className="muted">{t('cm.gone')}</p></div>
  const { post, replies } = data
  const self = (u: string) => store.user?.username.toLowerCase() === u.toLowerCase()
  const g = gameOf(post.gameId)
  return (
    <div className="postview">
      <button className="link-btn" onClick={onBack}>← Back to {g ? `${g.title} hub` : 'community'}</button>
      <div className="pv-card">
        <div className="g-title">{post.kind === 'guide' ? 'Guide' : 'Discussion'}</div>
        <h2 className="pv-h">{post.title}</h2>
        <div className="pv-by"><Avatar f={{ name: post.name }} size={30} ring={false} /> <Link to={`/profile/${post.username}`}>{post.name}</Link> <span className="muted small">· {ago(post.at)}</span></div>
        <div className="pv-body">{post.body}</div>
        <div className="pv-actions">
          <button className={`btn small ${post.mine ? 'blue' : ''}`} disabled={self(post.username)} onClick={async () => {
            if (store.needLogin()) return
            const r = await call<{ votes: number; voted: boolean }>('POST', `/posts/${id}/vote`)
            if (r.data) setData({ post: { ...post, votes: r.data.votes, mine: r.data.voted }, replies }); else store.toast(r.error ?? 'Could not vote')
          }}><Icon name="thumbUp" size={14} /> {post.votes}</button>
          {self(post.username) && <button className="link-btn small" onClick={async () => { if (confirm('Delete this post?')) { await call('DELETE', `/posts/${id}`); onBack() } }}>{t('rv.delete')}</button>}
          {!self(post.username) && store.signedIn && <button className="link-btn small" onClick={async () => { if (confirm('Report this post?')) { const r = await call('POST', `/posts/${id}/report`, { reason: 'reported by a user' }); store.toast(r.error ?? 'Reported. Thank you.') } }}>{t('rv.report')}</button>}
        </div>
      </div>
      <h3 className="pv-rh">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</h3>
      {replies.map(r => (
        <div key={r.id} className="pv-reply">
          <Avatar f={{ name: r.name }} size={34} ring={false} />
          <div className="grow"><div><Link to={`/profile/${r.username}`}>{r.name}</Link> <span className="muted small">· {ago(r.at)}</span></div><div className="pv-body">{r.body}</div></div>
          {self(r.username) && <button className="link-btn small" onClick={async () => { await call('DELETE', `/replies/${r.id}`); void load() }}>{t('rv.delete')}</button>}
        </div>
      ))}
      {store.signedIn ? (
        <form className="pv-form" onSubmit={async e => {
          e.preventDefault()
          const { error } = await call('POST', `/posts/${id}/replies`, { body: text })
          if (error) setErr(error); else { setText(''); setErr(''); void load() }
        }}>
          <textarea className="input" rows={3} placeholder={t('cm.writereply')} maxLength={4000} value={text} onChange={e => { setText(e.target.value); setErr('') }} />
          {err && <div className="err">{err}</div>}
          <button className="btn blue" disabled={text.trim().length < 1}>{t('cm.postreply')}</button>
        </form>
      ) : <p className="muted"><Link to={`/login?next=${encodeURIComponent(`/community?hub=${post.gameId}&post=${id}`)}`}>Sign in</Link> to reply.</p>}
    </div>
  )
})

export const Community = observer(() => {
  const [sp, setSp] = useSearchParams()
  const hub = Number(sp.get('hub') ?? 0)
  const hubGame = gameOf(hub)
  const postId = Number(sp.get('post') ?? 0)
  const tabParam = sp.get('tab') as Tab | null
  const tab: Tab = tabParam && (TABS as readonly string[]).includes(tabParam) ? tabParam : 'All'
  const [popular, setPopular] = useState(true)
  const [hubQ, setHubQ] = useState('')
  const [peopleQ, setPeopleQ] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [hubs, setHubs] = useState<Hub[]>([])
  const [feed, setFeed] = useState<FeedItem[] | null>(null)
  const [writing, setWriting] = useState<Kind | null>(null)
  const [shown, setShown] = useState(18)

  const setParams = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n); setShown(18) }
  const openPost = (p: number) => { const n = new URLSearchParams(sp); n.set('post', String(p)); setSp(n) }

  useEffect(() => { void api<{ hubs: Hub[] }>('GET', '/community/hubs').then(r => setHubs(r?.hubs ?? [])) }, [])
  const loadFeed = useCallback(async () => {
    setFeed(null)
    const sort = popular ? 'popular' : 'recent'
    if (hubGame) {
      const [rv, ps, nw] = await Promise.all([
        tab === 'All' || tab === 'Reviews' ? api<{ reviews: Review[] }>('GET', `/games/${hubGame.id}/reviews?sort=${popular ? 'helpful' : 'recent'}`) : null,
        tab !== 'Reviews' && tab !== 'News' ? api<{ posts: Post[] }>('GET', `/games/${hubGame.id}/posts?sort=${sort}${tab === 'Discussions' ? '&kind=discussion' : tab === 'Guides' ? '&kind=guide' : ''}`) : null,
        tab === 'All' || tab === 'News' ? api<{ news: NewsRow[] }>('GET', `/games/${hubGame.id}/news`) : null,
      ])
      const items: FeedItem[] = [
        ...(rv?.reviews ?? []).map(r => ({ type: 'review' as const, at: r.at, score: r.helpful, item: r })),
        ...(ps?.posts ?? []).map(p => ({ type: p.kind, at: p.at, score: p.votes + p.replies, item: p })),
        ...(nw?.news ?? []).map(n => ({ type: 'news' as const, at: n.at, score: 1e9, item: n })),
      ]
      setFeed(items.sort((a, b) => (popular ? b.score - a.score || b.at - a.at : b.at - a.at)))
    } else {
      const r = await api<{ items: FeedItem[] }>('GET', `/community/feed?sort=${sort}`)
      const all = r?.items ?? []
      setFeed(all.filter(i => tab === 'All' || (tab === 'Discussions' && i.type === 'discussion') || (tab === 'Guides' && i.type === 'guide') || (tab === 'Reviews' && i.type === 'review') || (tab === 'News' && i.type === 'news')))
    }
  }, [hubGame, tab, popular])
  useEffect(() => { void loadFeed() }, [loadFeed])

  useEffect(() => {
    if (peopleQ.trim().length < 2 || !store.signedIn) { setPeople([]); return }
    let live = true
    const t = setTimeout(() => { void store.search(peopleQ.trim()).then(r => { if (live) setPeople(r) }) }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [peopleQ])

  const recentHubs = [...store.ownedGames].filter(g => store.lastPlayed[g.id]).sort((a, b) => (store.lastPlayed[b.id] ?? 0) - (store.lastPlayed[a.id] ?? 0)).slice(0, 3)
  const hubHits = hubQ.trim() ? GAMES.filter(g => g.title.toLowerCase().includes(hubQ.trim().toLowerCase())).slice(0, 5) : []
  const friendsIn = hubGame ? store.friendsPlaying(hubGame.id).length : 0

  if (postId) return <div className="community"><div className="cm-wrap"><PostView id={postId} onBack={() => { const n = new URLSearchParams(sp); n.delete('post'); setSp(n); void loadFeed() }} /></div></div>

  const items = feed ?? []
  return (
    <div className="community">
      <div className="cm-wrap">
        {hubGame ? (
          <>
            <div className="hub-top"><h1>{hubGame.title}</h1><Link to={`/store/${hubGame.id}`} className="storepage">{t('fr.storepage')}</Link></div>
            <div className="cm-tabs hubtabs">{TABS.map(tb => <button key={tb} className={tb === tab ? 'on' : ''} onClick={() => setParams('tab', tb === 'All' ? null : tb)}>{t(TAB_KEY[tb])}</button>)}
              <span className="grow" />
              <button className="btn small" onClick={() => store.needLogin() || setWriting('discussion')}>{t('cm.newdisc')}</button>
              <button className="btn small" disabled={store.signedIn && !store.owned.includes(hubGame.id)} title={store.signedIn && !store.owned.includes(hubGame.id) ? 'Only owners can write guides' : undefined} onClick={() => store.needLogin() || setWriting('guide')}>{t('cm.guide')}</button>
            </div>
            <div className="hub-banner">
              <div className="hub-stats"><span className="ingame">{compact(hubGame.playing)} In-Game</span><span>{compact(hubGame.owners)} owner{hubGame.owners === 1 ? '' : 's'}</span><span>{compact(hubGame.reviews)} review{hubGame.reviews === 1 ? '' : 's'}</span><button className="link-btn" onClick={() => store.toggleFollow(hubGame.id)}>{store.followed.includes(hubGame.id) ? 'Following' : 'Follow'}</button>{friendsIn > 0 && <span className="pos">{friendsIn} friend{friendsIn === 1 ? '' : 's'} playing</span>}</div>
              <div className="hub-main">
                <div className="hub-cap"><Art game={hubGame} kind="header" /></div>
                <div><p>{hubGame.blurb}</p>
                  <div className="hub-buy"><span className="hub-price">{hubGame.price === 0 ? 'Free' : fmt(priceOf(hubGame))}</span><Link to={`/store/${hubGame.id}`} className="visit">{t('cm.visitstore')}</Link>
                    <button className="link-btn" onClick={() => { const n = new URLSearchParams(sp); n.delete('hub'); n.delete('tab'); setSp(n) }}>{t('cm.allcomm')}</button></div></div>
              </div>
            </div>
            <div className="popular-note">{t('cm.popularnote')}</div>
          </>
        ) : (
          <>
            <h1>{t('comm.activity')}</h1><p className="cm-sub">{t('cm.sub')}</p>
            <div className="cm-panels">
              <div className="cm-panel cols2">
                <div>
                  <h4>{store.signedIn ? 'YOUR RECENTLY PLAYED GAMES' : 'WELCOME TO THE COMMUNITY'}</h4>
                  {!store.signedIn && <div className="cm-welcome"><p>{t('cm.welcome')}</p><div className="cm-wbtns"><Link to="/login?next=/community" className="btn green">{t('cm.signin')}</Link><span>or</span><Link to="/login?mode=join&next=/community" className="btn green">{t('cm.join')}</Link></div></div>}
                  {store.signedIn && recentHubs.length === 0 && <div className="muted">{t('cm.noplayed')}</div>}
                  {recentHubs.map(g => <Link key={g.id} to={`/community?hub=${g.id}`} className="hubrow"><Art game={g} kind="icon" className="hub-icon" /><div><div className="hn">{g.title}</div><div className="hl">{hours(store.playtime[g.id])} played</div></div></Link>)}
                </div>
                <div>
                  <h4>{t('cm.busiest')}</h4>
                  {hubs.length === 0 && <div className="muted">Loading…</div>}
                  {hubs.slice(0, 4).map(h => { const g = gameOf(h.gameId); return g && <Link key={g.id} to={`/community?hub=${g.id}`} className="hubrow"><Art game={g} kind="icon" className="hub-icon" /><div><div className="hn">{g.title}</div><div className="hl">{h.playing} in-game · {h.posts} posts this week</div></div></Link> })}
                </div>
              </div>
              <div className="cm-panel">
                <h4>{t('comm.findhubs')}</h4>
                <div className="cm-search"><input placeholder={t('cm.searchprod')} value={hubQ} onChange={e => setHubQ(e.target.value)} aria-label={t('cm.searchprod')} /><Icon name="search" size={22} /></div>
                {hubHits.map(g => <Link key={g.id} to={`/community?hub=${g.id}`} className="hl-hit">{g.title}</Link>)}
                <h4 className="mt">{t('comm.findpeople')}</h4>
                <div className="cm-search"><input placeholder={store.signedIn ? 'Search by account name' : 'Sign in to search people'} disabled={!store.signedIn} value={peopleQ} onChange={e => setPeopleQ(e.target.value)} aria-label={t('cm.searchppl')} /><Icon name="search" size={22} /></div>
                {people.map(u => <Link key={u.username} to={`/profile/${u.username}`} className="hl-hit"><Avatar f={{ name: u.name }} size={22} ring={false} /> {u.name} <span className="muted small">@{u.username}</span></Link>)}
                {store.signedIn && peopleQ.trim().length >= 2 && people.length === 0 && <div className="small muted">No accounts match "{peopleQ.trim()}".</div>}
              </div>
            </div>
            <div className="cm-tabs">
              {TABS.map(tb => <button key={tb} className={tb === tab ? 'on' : ''} onClick={() => setParams('tab', tb === 'All' ? null : tb)}>{t(TAB_KEY[tb])}</button>)}
              <span className="grow" />
              <span className="muted viewing">{t('comm.viewing')}</span>
              <button className={`seg ${popular ? 'on' : ''}`} onClick={() => setPopular(true)}>{t('comm.popular')}</button>
              <button className={`seg ${!popular ? 'on' : ''}`} onClick={() => setPopular(false)}>{t('comm.recent')}</button>
            </div>
          </>
        )}
        {hubGame && <div className="cm-tabs viewrow"><span className="grow" /><span className="muted viewing">{t('comm.viewing')}</span>
          <button className={`seg ${popular ? 'on' : ''}`} onClick={() => setPopular(true)}>{t('comm.popular')}</button><button className={`seg ${!popular ? 'on' : ''}`} onClick={() => setPopular(false)}>{t('comm.recent')}</button></div>}

        {feed === null && <Loading />}
        <div className="cm-grid one">
          {items.slice(0, shown).map(i => i.type === 'news'
            ? <div className="cc news-card" key={`n${(i.item as NewsRow).id}`}><div className="g-title">News</div><div className="nc-body"><b>{(i.item as NewsRow).title}</b><div className="muted small">{ago((i.item as NewsRow).at)} · {(i.item as NewsRow).author}</div><p>{(i.item as NewsRow).body}</p></div></div>
            : i.type === 'review'
            ? <FeedReview key={`r${(i.item as Review).id}`} r={i.item as Review} />
            : <PostCard key={`p${(i.item as Post).id}`} p={i.item as Post} showGame={!hubGame} onOpen={() => { const p = i.item as Post; const n = new URLSearchParams(sp); n.set('hub', String(p.gameId)); n.set('post', String(p.id)); setSp(n) }} />)}
        </div>
        {feed !== null && items.length === 0 && <p className="muted">Nothing here yet. {hubGame ? 'Be the first to post.' : 'Reviews and discussions people write will appear here.'}</p>}
        {shown < items.length && <div className="cm-more"><button className="btn" onClick={() => setShown(shown + 18)}>{t('cm.more')}</button></div>}
      </div>
      {writing && hubGame && <NewPost g={hubGame} kind={writing} onClose={() => setWriting(null)} onDone={id => { setWriting(null); openPost(id) }} />}
    </div>
  )
})
