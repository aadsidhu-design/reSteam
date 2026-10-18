import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { compact, reviewLabel, type Game } from './data'
import { api, call, store } from './store'
import { Icon } from './icons'
import { Avatar, ago, hours } from './ui'
import { reviewClass } from './StorePages'

export interface Review {
  id: number; gameId: number; recommend: boolean; text: string; playtime: number; at: number
  username: string; name: string; helpful: number; funny: number; mine: string[]
}

export const ReviewCard = observer(({ r, onChange, game }: { r: Review; onChange?: () => void; game?: Game }) => {
  const [helpful, setHelpful] = useState(r.helpful)
  const [voted, setVoted] = useState(r.mine.includes('helpful'))
  const self = store.user?.username.toLowerCase() === r.username.toLowerCase()
  useEffect(() => { setHelpful(r.helpful); setVoted(r.mine.includes('helpful')) }, [r.helpful, r.mine])
  const vote = async () => {
    if (store.needLogin()) return
    const { data, error } = await call<{ helpful: number; voted: boolean }>('POST', `/reviews/${r.id}/vote`, { kind: 'helpful' })
    if (data) { setHelpful(data.helpful); setVoted(data.voted) } else store.toast(error ?? 'Could not vote')
  }
  return (
    <div className="rv-card">
      <div className="rv-author"><Avatar f={{ name: r.name }} size={34} ring={false} /><div><Link to={`/profile/${r.username}`}>{r.name}</Link><div className="muted small">{hours(r.playtime)} on record</div></div></div>
      <div className="rv-main">
        <div className="rv-head"><span className={`rv-thumb ${r.recommend ? '' : 'down'}`}><Icon name="thumbUp" size={22} /></span><div><div className="rv-verdict">{r.recommend ? 'Recommended' : 'Not Recommended'}</div>
          {game && <div className="muted small">for <Link to={`/store/${game.id}`}>{game.title}</Link></div>}</div></div>
        <div className="muted small">Posted: {new Date(r.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        <p className="rv-text">{r.text}</p>
        <div className="rv-foot">
          <span className="muted small">Was this review helpful?</span>
          <button className={`btn small ${voted ? 'blue' : ''}`} disabled={self} onClick={() => void vote()} title={self ? 'You cannot vote on your own review' : undefined}>Yes</button>
          <span className="muted small">{helpful} {helpful === 1 ? 'person' : 'people'} found this review helpful</span>
          {self && onChange && <button className="link-btn small" onClick={async () => { if (confirm('Delete your review?')) { await call('DELETE', `/games/${r.gameId}/review`); onChange() } }}>Delete</button>}
          {!self && store.signedIn && <button className="link-btn small" onClick={async () => { if (confirm('Report this review to the moderators?')) { const e = await call('POST', `/reviews/${r.id}/report`, { reason: 'reported by a user' }); store.toast(e.error ?? 'Reported. Thank you.') } }}>Report</button>}
        </div>
      </div>
    </div>
  )
})

const WriteReview = observer(({ g, mine, onSaved }: { g: Game; mine?: Review; onSaved: () => void }) => {
  const [recommend, setRecommend] = useState<boolean | null>(mine ? mine.recommend : null)
  const [text, setText] = useState(mine?.text ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (mine) { setRecommend(mine.recommend); setText(mine.text) } }, [mine?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!store.signedIn) return <p className="muted"><Link to={`/login?next=${encodeURIComponent(`/store/${g.id}`)}`}>Sign in</Link> to review games you own.</p>
  if (!store.owned.includes(g.id)) return <p className="muted small">You can write a review once you own {g.title}.</p>
  return (
    <form className="rv-write" onSubmit={async e => {
      e.preventDefault()
      if (recommend === null) { setErr('Choose Recommended or Not Recommended.'); return }
      setBusy(true)
      const { error } = await call('PUT', `/games/${g.id}/review`, { recommend, text })
      setBusy(false)
      if (error) setErr(error); else { setErr(''); store.toast(mine ? 'Review updated' : 'Review posted'); void store.loadStats(); onSaved() }
    }}>
      <div className="rv-write-h">{mine ? 'Edit your review' : `Write a review for ${g.title}`}</div>
      <textarea className="input" rows={4} maxLength={8000} placeholder="Please describe what you liked or disliked about this game and whether you recommend it to others." value={text} onChange={e => { setText(e.target.value); setErr('') }} />
      <div className="rv-write-row">
        <button type="button" className={`btn ${recommend === true ? 'blue' : ''}`} onClick={() => setRecommend(true)}><Icon name="thumbUp" size={16} /> Yes</button>
        <button type="button" className={`btn ${recommend === false ? 'red' : ''}`} onClick={() => setRecommend(false)}><span className="flip"><Icon name="thumbUp" size={16} /></span> No</button>
        <span className="grow" />
        <button className="btn green" disabled={busy || text.trim().length < 10}>{mine ? 'Update review' : 'Post review'}</button>
      </div>
      {err && <div className="err">{err}</div>}
    </form>
  )
})

/** The "Customer reviews" block on a store page. */
export const GameReviews = observer(({ g }: { g: Game }) => {
  const [list, setList] = useState<Review[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative'>('all')
  const [sort, setSort] = useState<'helpful' | 'recent'>('helpful')
  const load = useCallback(async () => {
    const r = await api<{ reviews: Review[] }>('GET', `/games/${g.id}/reviews?sort=${sort}${filter === 'all' ? '' : `&filter=${filter}`}`)
    setList(r?.reviews ?? [])
  }, [g.id, sort, filter])
  useEffect(() => { void load() }, [load])
  const mine = list?.find(r => r.username.toLowerCase() === store.user?.username.toLowerCase())
  const positivePct = g.reviews > 0 ? g.rating : 0
  return (
    <>
      <h2 className="ul">Customer reviews</h2>
      <div className="rv-sum">
        <div><span className="muted small">Overall</span><br /><span className={reviewClass(g.rating, g.reviews)}>{reviewLabel(g.rating, g.reviews)}</span></div>
        <div><span className="muted small">Total reviews</span><br />{compact(g.reviews)}</div>
      </div>
      {g.reviews > 0 && <>
        <div className="rv-bar" title={`${positivePct}% positive`}><span style={{ width: `${positivePct}%` }} /></div>
        <div className="muted small" style={{ marginBottom: 14 }}>{positivePct}% of the {compact(g.reviews)} user reviews for this game are positive.</div>
      </>}
      <WriteReview g={g} mine={mine} onSaved={() => void load()} />
      <div className="rv-filters">
        <label>Show <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} aria-label="Filter reviews"><option value="all">All reviews</option><option value="positive">Positive</option><option value="negative">Negative</option></select></label>
        <label>Sort <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort reviews"><option value="helpful">Most helpful</option><option value="recent">Most recent</option></select></label>
      </div>
      <div className="rv-list one">
        {list === null && <div className="muted">Loading reviews…</div>}
        {list?.length === 0 && <div className="muted">{g.reviews === 0 ? 'No one has reviewed this game yet.' : 'No reviews match this filter.'}</div>}
        {list?.map(r => <ReviewCard key={r.id} r={r} onChange={() => { void load(); void store.loadStats() }} />)}
      </div>
    </>
  )
})

export { ago }
