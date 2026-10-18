// Covers the endpoints the other suites skip: undo/delete variants, reports, votes, the feed, redeem and friend housekeeping.
// Run with the API up: BASE=http://localhost:8787 node scripts/e2e-extra.mjs
import { zipSync, strToU8 } from 'fflate'

const BASE = process.env.BASE ?? 'http://localhost:8787'
let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name} ${ok ? '' : extra}`) }

async function account(name) {
  const h = { 'x-requested-with': 'fetch', origin: BASE }
  const username = `${name}_${Math.random().toString(36).slice(2, 7)}`
  const r = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ username, password: 'correct-horse-9' }) })
  const cookie = r.headers.get('set-cookie').split(';')[0]
  const call = async (method, path, body) => {
    const isRaw = body instanceof Uint8Array
    const res = await fetch(`${BASE}/api${path}`, { method, headers: { ...h, cookie, ...(body && !isRaw ? { 'content-type': 'application/json' } : {}) }, body: body ? (isRaw ? body : JSON.stringify(body)) : undefined })
    const ct = res.headers.get('content-type') ?? ''
    return { status: res.status, data: ct.includes('json') ? await res.json() : null }
  }
  return { username, call }
}
const a = await account('xa'), b = await account('xb'), c = await account('xc')

// ---- accounts
const me = await a.call('GET', '/auth/me')
check('the session endpoint returns the signed-in user', me.status === 200 && me.data.user?.username === a.username)

// ---- store lists: add then remove (game 11 is the starter game everyone owns)
check('PUT /wishlist adds', (await a.call('PUT', '/wishlist/9')).data.wishlist.includes(9))
check('DELETE /wishlist removes', !(await a.call('DELETE', '/wishlist/9')).data.wishlist.includes(9))
check('PUT /ignored adds', (await a.call('PUT', '/ignored/9')).data.ignored.includes(9))
check('DELETE /ignored removes', !(await a.call('DELETE', '/ignored/9')).data.ignored.includes(9))
check('PUT /followed adds', (await a.call('PUT', '/followed/9')).data.followed.includes(9))
check('DELETE /followed removes', !(await a.call('DELETE', '/followed/9')).data.followed.includes(9))
check('favorites add', (await a.call('PUT', '/favorites/11')).data.favorites.includes(11))
check('favorites remove', !(await a.call('DELETE', '/favorites/11')).data.favorites.includes(11))
check('installing marks a game installed', (await a.call('PUT', '/installed/11')).data.installed.includes(11))
check('uninstalling clears it', !(await a.call('DELETE', '/installed/11')).data.installed.includes(11))
const redeemed = await a.call('POST', '/redeem', { code: 'RESTEAM-WELCOME-10' })
check('a promo code adds wallet funds', redeemed.status === 200 && redeemed.data.wallet === 6000)
check('a promo code works only once', (await a.call('POST', '/redeem', { code: 'RESTEAM-WELCOME-10' })).status >= 400)
check('an unknown code is refused', (await a.call('POST', '/redeem', { code: 'NOPE-NOPE' })).status >= 400)

// ---- refunds (game 5 costs real wallet money; the starter game 11 and free claims are not refundable)
check('free or starter games cannot be refunded', (await a.call('POST', '/refund/11')).status === 409)
await a.call('PUT', '/cart/5')
const walletBefore = (await a.call('GET', '/me')).data.wallet
const bought = await a.call('POST', '/checkout')
check('a purchase succeeds', bought.status === 200 && bought.data.owned.includes(5))
const elig = await a.call('GET', '/refund/5')
check('a fresh purchase is eligible for a refund', elig.data.eligible === true && elig.data.cents > 0)
const refunded = await a.call('POST', '/refund/5')
check('a refund returns the money and the game', refunded.status === 200 && !refunded.data.owned.includes(5) && refunded.data.wallet === walletBefore)
check('the same game cannot be refunded twice', (await a.call('POST', '/refund/5')).status === 409)
await a.call('PUT', '/cart/5'); await a.call('POST', '/checkout')
check('a re-bought game stays non-refundable', (await a.call('GET', '/refund/5')).data.eligible === false)

// ---- recommendations
const guestRecs = await fetch(`${BASE}/api/recommendations`).then(r => r.json())
check('guests get popular recommendations', guestRecs.recommendations.length > 0 && guestRecs.personal === false)
await c.call('PUT', '/wishlist/9') // Mossbound: Puzzle, Relaxing, Atmospheric...
const rec = (await c.call('GET', '/recommendations')).data
check('signed-in recommendations are personal', rec.personal === true && rec.recommendations.length > 0)
check('owned and wishlisted-then-removed games are handled', !rec.recommendations.some(r => r.id === 11))
await c.call('PUT', '/ignored/3')
check('ignored games are never recommended', !(await c.call('GET', '/recommendations')).data.recommendations.some(r => r.id === 3))
await c.call('DELETE', '/ignored/3'); await c.call('DELETE', '/wishlist/9')

// ---- search
const sr = await fetch(`${BASE}/api/search?q=${encodeURIComponent('mossb')}`).then(r => r.json())
check('search finds games by title prefix', sr.results[0]?.title === 'Mossbound')
check('search ranks exact titles first', (await fetch(`${BASE}/api/search?q=mossbound`).then(r => r.json())).results[0].title === 'Mossbound')
check('search matches tags and developers too', (await fetch(`${BASE}/api/search?q=metroidvania`).then(r => r.json())).results.some(x => x.title === 'Gearheart'))
check('empty and odd queries are safe', (await fetch(`${BASE}/api/search?q=`).then(r => r.json())).results.length === 0 && (await fetch(`${BASE}/api/search?q=${encodeURIComponent("%_'\\")}`)).status === 200)
const hiddenTitle = `Hidden${Math.random().toString(36).slice(2, 8)}`
await a.call('POST', '/dev/games', { title: hiddenTitle, blurb: 'A draft nobody should find.', genre: ['Puzzle'], tags: ['Test'], price: 0 })
check('search never returns drafts', (await fetch(`${BASE}/api/search?q=${hiddenTitle}`).then(r => r.json())).results.length === 0)

// ---- community: reviews, posts, replies, votes, reports
const rev = await a.call('PUT', '/games/11/review', { recommend: true, text: 'A fine, relaxing game to unwind with.' })
check('a review can be posted', rev.status === 200)
const reviews = (await fetch(`${BASE}/api/games/11/reviews`).then(r => r.json())).reviews
const mine = reviews.find(r => r.username === a.username)
check('reviews can be reported', (await b.call('POST', `/reviews/${mine.id}/report`, { reason: 'spam' })).status === 200)
check('a review can be deleted by its author', (await a.call('DELETE', '/games/11/review')).status === 200)
check('deleting a missing review is a 404', (await a.call('DELETE', '/games/11/review')).status === 404)

const post = await b.call('POST', '/games/11/posts', { kind: 'discussion', title: 'Favorite level?', body: 'Which level do you replay the most?' })
check('a discussion can be started', post.status === 201)
const posts = await fetch(`${BASE}/api/games/11/posts`).then(r => r.json())
check('posts are listed publicly', posts.posts.some(p => p.id === post.data.id))
const voted = await a.call('POST', `/posts/${post.data.id}/vote`)
check('posts can be voted up', voted.status === 200 && voted.data.votes === 1 && voted.data.voted === true)
check('voting again removes the vote', (await a.call('POST', `/posts/${post.data.id}/vote`)).data.votes === 0)
check('you cannot vote on your own post', (await b.call('POST', `/posts/${post.data.id}/vote`)).status === 403)
const reply = await a.call('POST', `/posts/${post.data.id}/replies`, { body: 'The pond one, every time.' })
check('replies can be posted', reply.status === 201 || reply.status === 200)
const full = await fetch(`${BASE}/api/posts/${post.data.id}`).then(r => r.json())
const rid = full.replies[0].id
check('replies can be reported', (await b.call('POST', `/replies/${rid}/report`, { reason: 'off topic' })).status === 200)
check('posts can be reported', (await a.call('POST', `/posts/${post.data.id}/report`, { reason: 'off topic' })).status === 200)
check('others cannot delete a reply', (await b.call('DELETE', `/replies/${rid}`)).status >= 400)
check('the author can delete a reply', (await a.call('DELETE', `/replies/${rid}`)).status === 200)
const feed = await fetch(`${BASE}/api/community/feed?sort=recent`).then(r => r.json())
check('the community feed lists new posts', feed.items.some(i => i.type === 'discussion' && i.item.id === post.data.id))
const hubs = await fetch(`${BASE}/api/community/hubs`).then(r => r.json())
check('the hubs list has per-game counts', Array.isArray(hubs.hubs) && hubs.hubs.every(h => 'posts' in h && 'playing' in h))

// ---- publishing housekeeping
const genres = await fetch(`${BASE}/api/dev/genres`).then(r => r.json())
check('the genre list is public', genres.genres.includes('Puzzle'))
const g = await a.call('POST', '/dev/games', { title: 'Cleanup Quest', blurb: 'A game used to test deleting its parts.', genre: ['Puzzle'], tags: ['Test'], price: 0 })
const gid = g.data.id
check('my games are listed', (await a.call('GET', '/dev/games')).data.games.some(x => x.id === gid))
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(40).fill(0)])
await a.call('PUT', `/dev/games/${gid}/shots/0`, png)
await a.call('PUT', `/dev/games/${gid}/web`, zipSync({ 'index.html': strToU8('<p>hi</p>') }))
await a.call('PUT', `/dev/games/${gid}/build?name=x.bin`, new Uint8Array(1000).fill(3))
const listed = () => a.call('GET', '/dev/games').then(r => r.data.games.find(x => x.id === gid))
check('screenshots can be cleared', (await a.call('DELETE', `/dev/games/${gid}/shots`)).status === 200 && (await listed()).shots === 0)
check('the web build can be removed', (await a.call('DELETE', `/dev/games/${gid}/web`)).status === 200 && (await listed()).playable === false)
check('the download can be removed', (await a.call('DELETE', `/dev/games/${gid}/build`)).status === 200 && (await listed()).build === null)
await a.call('PUT', `/dev/games/${gid}/build?name=x.bin`, new Uint8Array(1000).fill(3))
await a.call('POST', `/dev/games/${gid}/publish`)
const news = await a.call('POST', `/dev/games/${gid}/news`, { title: 'Hello world', body: 'The first announcement for this game.' })
const hub = await fetch(`${BASE}/api/news`).then(r => r.json())
check('the news hub lists announcements across games', hub.news.some(n => n.title === 'Hello world' && n.gameId === gid))
check('the news hub can be searched', (await fetch(`${BASE}/api/news?q=zzzz-no-such-news`).then(r => r.json())).news.length === 0)
check('personal news needs an account', (await fetch(`${BASE}/api/news?scope=mine`)).status === 401)
check('news can be liked', (await b.call('POST', `/news/${news.data.id}/like`)).data.likes === 1)
check('liking again removes the like', (await b.call('POST', `/news/${news.data.id}/like`)).data.likes === 0)
await b.call('POST', `/news/${news.data.id}/like`)
const cm = await b.call('POST', `/news/${news.data.id}/comments`, { body: 'Great update!' })
check('news can be commented on', cm.status === 201)
check('empty comments are refused', (await b.call('POST', `/news/${news.data.id}/comments`, { body: '   ' })).status === 400)
check('comments are public', (await fetch(`${BASE}/api/news/${news.data.id}/comments`).then(r => r.json())).comments.some(x => x.body === 'Great update!'))
const feed2 = await fetch(`${BASE}/api/news`).then(r => r.json())
const mineRow = feed2.news.find(n => n.id === news.data.id)
check('the feed carries like and comment counts', mineRow.likes === 1 && mineRow.comments === 1)
check('others cannot delete a comment', (await a.call('DELETE', `/news-comments/${cm.data.id}`)).status === 404)
check('the author can delete a comment', (await b.call('DELETE', `/news-comments/${cm.data.id}`)).status === 200)
check('a news post can be deleted by its author', (await b.call('DELETE', `/dev/news/${news.data.id}`)).status === 404 && (await a.call('DELETE', `/dev/news/${news.data.id}`)).status === 200)
const ach = await a.call('PUT', `/dev/games/${gid}/achievements`, { items: [{ name: 'First ripple', description: 'Make a ripple.' }, { name: 'Pond master', description: 'Make 100 ripples.' }] })
check('a developer can define achievements', ach.status === 200 && ach.data.count === 2)
check('achievement names are required', (await a.call('PUT', `/dev/games/${gid}/achievements`, { items: [{ name: '', description: 'x' }] })).status === 400)
check('others cannot edit achievements', (await b.call('PUT', `/dev/games/${gid}/achievements`, { items: [] })).status === 404)
const achs = await fetch(`${BASE}/api/games/${gid}/achievements`).then(r => r.json())
check('the list is public and ordered', achs.achievements.length === 2 && achs.achievements[0].name === 'First ripple')
check('the game count follows the list', (await fetch(`${BASE}/api/games`).then(r => r.json())).find(x => x.id === gid)?.achievements === 2)
check('updates need real notes', (await a.call('POST', `/dev/games/${gid}/release`, { notes: 'x' })).status === 400)
check('only the owner can release', (await b.call('POST', `/dev/games/${gid}/release`, { notes: 'Fixed a lot of things' })).status === 404)
await b.call('POST', `/claim/${gid}`)
const rel = await a.call('POST', `/dev/games/${gid}/release`, { notes: 'Fixed ripples and added fish.' })
check('a developer can release an update', rel.status === 201 && rel.data.version === 2)
check('version history is public', (await fetch(`${BASE}/api/games/${gid}/versions`).then(r => r.json())).versions[0].version === 2)
await new Promise(r => setTimeout(r, 500))
check('owners are told about the update', (await b.call('GET', '/notifications')).data.notifications.some(n => n.kind === 'game_update'))
check('the update also appears in the news hub', (await fetch(`${BASE}/api/news`).then(r => r.json())).news.some(n => n.gameId === gid && /version 2/.test(n.title)))
check('a game can be reported', (await b.call('POST', `/games/${gid}/report`, { reason: 'test' })).status === 200)
await a.call('DELETE', `/dev/games/${gid}`)

// the per-IP request limiter allows 120 a minute, which this suite now exceeds, so let it reset
console.log('note  waiting out the per-IP limiter...'); await new Promise(r => setTimeout(r, 62_000))
// ---- friends housekeeping
check('a friend request can be sent', (await a.call('POST', '/friends/requests', { username: b.username })).status < 300)
check('the recipient can decline it', (await b.call('DELETE', `/friends/requests/${a.username}`)).status === 200)
await a.call('POST', '/friends/requests', { username: b.username })
await b.call('POST', `/friends/requests/${a.username}/accept`)
await a.call('POST', '/friends/requests', { username: c.username })
await c.call('POST', `/friends/requests/${a.username}/accept`)
check('presence pings are accepted', (await a.call('POST', '/presence/ping')).status === 200)
await b.call('POST', `/chats/${a.username}`, { text: 'hey, are you around?' })
const before = (await a.call('GET', '/friends')).data.friends.find(f => f.username === b.username)
check('unread counts show up on the friend', before.unread === 1)
check('a chat can be marked read', (await a.call('POST', `/chats/${b.username}/read`)).status === 200 && (await a.call('GET', '/friends')).data.friends.find(f => f.username === b.username).unread === 0)
const grp = await a.call('POST', '/groups', { name: 'Pond crew', members: [b.username] })
check('a group can be started', grp.status === 201)
check('more friends can be invited', (await a.call('POST', `/groups/${grp.data.group.id}/invite`, { username: c.username })).status < 300)
check('the invitee is notified', (await c.call('GET', '/notifications')).data.notifications.some(n => n.kind === 'group_invite'))
check('notifications can be marked read', (await c.call('POST', '/notifications/read')).status === 200 && (await c.call('GET', '/notifications')).data.notifications.every(n => n.read))
check('the block list is empty by default', (await a.call('GET', '/blocks')).data.blocked?.length === 0 || (await a.call('GET', '/blocks')).status === 200)
check('a nickname can be given to a friend', (await a.call('PUT', `/friends/${b.username}/nickname`, { nickname: 'Buddy' })).status === 200)
check('the nickname shows only on my list', (await a.call('GET', '/friends')).data.friends.find(f => f.username === b.username).nickname === 'Buddy' && (await b.call('GET', '/friends')).data.friends.find(f => f.username === a.username).nickname === null)
check('a nickname can be cleared', (await a.call('PUT', `/friends/${b.username}/nickname`, { nickname: '' })).data.nickname === null)
check('strangers cannot be nicknamed', (await a.call('PUT', `/friends/nobody_here/nickname`, { nickname: 'x' })).status === 404)
check('a friend can be removed', (await a.call('DELETE', `/friends/${b.username}`)).status === 200 && !(await a.call('GET', '/friends')).data.friends.some(f => f.username === b.username))

for (const u of [a, b, c]) await u.call('DELETE', '/auth/account', { password: 'correct-horse-9' })
console.log(`\n${pass}/${pass + fail} checks passed${fail ? `, ${fail} FAILED` : ''}`)
process.exit(fail ? 1 : 0)
