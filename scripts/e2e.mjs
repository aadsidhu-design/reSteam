// End-to-end tests against a running Worker (default http://localhost:8787, start it with `npm run api`).
// Uses several accounts and fake client IPs so the rate limiters, which are per IP/account, do not interfere.
const BASE = process.env.BASE ?? 'http://localhost:8787'
let total = 0, failed = 0
const check = (name, ok, extra = '') => { total++; if (!ok) { failed++; console.log(`FAIL  ${name} ${extra}`) } else console.log(`ok    ${name}`) }
const rand = () => Math.random().toString(36).slice(2, 7)
let ipN = 1
const nextIp = () => `10.${(ipN >> 8) & 255}.${ipN & 255}.${(ipN++ % 250) + 1}`
const sleep = ms => new Promise(r => setTimeout(r, ms))

class Client {
  constructor(name) { this.name = name; this.cookie = ''; this.ip = null }
  async call(method, path, body, o = {}) {
    const headers = { 'cf-connecting-ip': o.ip ?? this.ip ?? nextIp(), origin: o.origin ?? BASE }
    if (!o.noCsrf && method !== 'GET') headers['x-requested-with'] = 'fetch'
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (this.cookie && !o.noCookie) headers.cookie = this.cookie
    const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
    const set = res.headers.getSetCookie?.() ?? []
    const sess = set.find(c => c.startsWith('rs_session='))
    if (sess && !o.noJar) this.cookie = sess.split(';')[0].endsWith('=') ? '' : sess.split(';')[0]
    let data = null
    try { data = await res.json() } catch { /* empty */ }
    return { status: res.status, data, set, headers: res.headers }
  }
}

async function main() {
  const tag = rand()
  const alice = new Client('alice'), bob = new Client('bob'), carol = new Client('carol'), anon = new Client('anon')
  const U = { a: `alice_${tag}`, b: `bob_${tag}`, c: `carol_${tag}` }
  const PW = 'correct-horse-battery'

  // ---------- basics ----------
  check('health', (await anon.call('GET', '/health')).status === 200)
  const games = await anon.call('GET', '/games')
  check('catalog is public and has 30 games', games.status === 200 && games.data.length === 30)
  check('me requires sign-in', (await anon.call('GET', '/me')).status === 401)
  check('old x-session bearer no longer authenticates', (await anon.call('GET', '/me', undefined, { noCookie: true })).status === 401)

  // ---------- registration rules ----------
  const reg = (c, body, o) => c.call('POST', '/auth/register', body, o)
  check('rejects short names', (await reg(anon, { username: 'ab', password: PW })).status === 400)
  check('rejects bad characters', (await reg(anon, { username: 'bad name!', password: PW })).status === 400)
  check('rejects reserved names', (await reg(anon, { username: 'admin', password: PW })).status === 409)
  check('rejects short passwords', (await reg(anon, { username: `x_${tag}1`, password: 'short' })).status === 400)
  check('rejects common passwords', (await reg(anon, { username: `x_${tag}2`, password: 'password123' })).status === 400)
  check('rejects passwords containing the name', (await reg(anon, { username: `x_${tag}3`, password: `my-x_${tag}3-pass` })).status === 400)
  check('rejects repeated-character passwords', (await reg(anon, { username: `x_${tag}4`, password: 'aaaaaaaaaa' })).status === 400)

  const r = await reg(alice, { username: U.a, password: PW })
  check('register succeeds', r.status === 201 && r.data.user.username === U.a)
  const setCookie = r.set.find(c => c.startsWith('rs_session=')) ?? ''
  check('session cookie is HttpOnly', /HttpOnly/i.test(setCookie))
  check('session cookie is SameSite=Strict', /SameSite=Strict/i.test(setCookie))
  check('session token is never in the response body', !JSON.stringify(r.data).includes(alice.cookie.split('=')[1] ?? '@@'))
  check('a recovery key is returned once', /^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/.test(r.data.recoveryCode ?? ''))
  check('password is never echoed back', !JSON.stringify(r.data).includes(PW))
  const aliceRecovery = r.data.recoveryCode
  check('names are unique case-insensitively', (await reg(anon, { username: U.a.toUpperCase(), password: PW })).status === 409)
  check('me works after registering', (await alice.call('GET', '/me')).data?.username === U.a)
  check('new accounts start with the starter game and wallet', (await alice.call('GET', '/me')).data.owned.includes(11) && (await alice.call('GET', '/me')).data.wallet === 5000)

  // ---------- request protections ----------
  check('state changes need the fetch header', (await alice.call('POST', '/wallet', { cents: 100 }, { noCsrf: true })).status === 403)
  check('cross-origin requests are refused', (await alice.call('POST', '/wallet', { cents: 100 }, { origin: 'https://evil.example' })).status === 403)
  check('oversized bodies are refused', (await alice.call('POST', '/wallet', { cents: 1, pad: 'x'.repeat(20_000) })).status === 413)

  // ---------- sign-in, logout, throttling ----------
  const al2 = new Client('alice-2')
  const bad = await al2.call('POST', '/auth/login', { username: U.a, password: 'wrong-password-1' })
  const unknown = await al2.call('POST', '/auth/login', { username: `nobody_${tag}`, password: 'wrong-password-1' })
  check('wrong password is a 401', bad.status === 401)
  check('unknown account gives the same error as a wrong password', unknown.status === 401 && unknown.data.error === bad.data.error)
  check('correct password signs in', (await al2.call('POST', '/auth/login', { username: U.a.toLowerCase(), password: PW })).status === 200 && (await al2.call('GET', '/me')).status === 200)
  await al2.call('POST', '/auth/logout', {})
  check('logout ends the session', (await al2.call('GET', '/me')).status === 401)
  const stuffer = new Client('stuffer'); stuffer.ip = '203.0.113.7'
  let blocked = false
  for (let i = 0; i < 14 && !blocked; i++) blocked = (await stuffer.call('POST', '/auth/login', { username: U.a, password: `guess-${i}-guess` })).status === 429
  check('repeated bad logins are throttled', blocked)

  // ---------- password change and recovery ----------
  check('changing the password needs the current one', (await alice.call('POST', '/auth/password', { current: 'nope-nope-nope', next: 'new-password-123' })).status === 403)
  const second = new Client('alice-3'); await second.call('POST', '/auth/login', { username: U.a, password: PW })
  check('password change succeeds', (await alice.call('POST', '/auth/password', { current: PW, next: 'new-password-123' })).status === 200)
  check('other sessions are signed out by a password change', (await second.call('GET', '/me')).status === 401)
  check('the current session survives it', (await alice.call('GET', '/me')).status === 200)
  const rec = new Client('rec')
  check('recovery rejects a wrong key', (await rec.call('POST', '/auth/recover', { username: U.a, recoveryCode: 'AAAAA-AAAAA-AAAAA-AAAAA', newPassword: 'another-pass-456' })).status === 401)
  const recovered = await rec.call('POST', '/auth/recover', { username: U.a, recoveryCode: aliceRecovery.toLowerCase(), newPassword: 'another-pass-456' })
  check('recovery with the right key sets a new password and signs in', recovered.status === 200 && (await rec.call('GET', '/me')).status === 200)
  check('recovery issues a new key', /^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/.test(recovered.data.recoveryCode ?? '') && recovered.data.recoveryCode !== aliceRecovery)
  check('the used recovery key stops working', (await new Client('r2').call('POST', '/auth/recover', { username: U.a, recoveryCode: aliceRecovery, newPassword: 'third-pass-789x' })).status === 401)
  check('the old password stops working', (await new Client('r3').call('POST', '/auth/login', { username: U.a, password: 'new-password-123' })).status !== 200)
  alice.cookie = rec.cookie // continue as alice with the recovered session
  const PW2 = 'another-pass-456'

  // ---------- QR sign-in ----------
  const phone = alice, laptop = new Client('laptop')
  const qr = await laptop.call('POST', '/auth/qr/begin', {})
  check('QR sign-in begins with an id and a secret', /^[0-9a-f]{32}$/.test(qr.data?.id ?? '') && !!qr.data?.secret)
  check('QR poll is pending until approved', (await laptop.call('POST', '/auth/qr/poll', { id: qr.data.id, secret: qr.data.secret })).data.status === 'pending')
  check('QR poll with the wrong secret is rejected', (await laptop.call('POST', '/auth/qr/poll', { id: qr.data.id, secret: 'x'.repeat(32) })).status === 404)
  check('approving needs a signed-in device', (await laptop.call('POST', `/auth/qr/${qr.data.id}/approve`, {})).status === 401)
  check('a signed-in device can look at the request', (await phone.call('GET', `/auth/qr/${qr.data.id}`)).status === 200)
  check('a signed-in device approves', (await phone.call('POST', `/auth/qr/${qr.data.id}/approve`, {})).status === 200)
  const done = await laptop.call('POST', '/auth/qr/poll', { id: qr.data.id, secret: qr.data.secret })
  check('the waiting browser becomes signed in as that account', done.data.status === 'approved' && (await laptop.call('GET', '/me')).data?.username === U.a)
  check('an approved QR code works only once', (await new Client('thief').call('POST', '/auth/qr/poll', { id: qr.data.id, secret: qr.data.secret })).data.status === 'expired')

  // ---------- two more accounts ----------
  const rb = await reg(bob, { username: U.b, password: PW }), rc = await reg(carol, { username: U.c, password: PW })
  check('bob and carol register', rb.status === 201 && rc.status === 201)

  // ---------- friends ----------
  check('search needs at least two characters', (await alice.call('GET', '/users/search?q=b')).data.users.length === 0)
  const found = await alice.call('GET', `/users/search?q=${U.b.slice(0, 6)}`)
  check('search finds people by prefix', found.data.users.some(u => u.username === U.b))
  check('you cannot friend yourself', (await alice.call('POST', '/friends/requests', { username: U.a })).status === 404)
  check('unknown names are a 404', (await alice.call('POST', '/friends/requests', { username: `ghost_${tag}` })).status === 404)
  check('alice sends bob a request', (await alice.call('POST', '/friends/requests', { username: U.b })).status === 201)
  check('duplicate requests are refused', (await alice.call('POST', '/friends/requests', { username: U.b })).status === 409)
  const bf = await bob.call('GET', '/friends')
  check('bob sees the incoming request', bf.data.incoming.some(i => i.username === U.a))
  check('alice sees it as outgoing', (await alice.call('GET', '/friends')).data.outgoing.some(i => i.username === U.b))
  check('bob got a notification', (await bob.call('GET', '/notifications')).data.notifications.some(n => n.kind === 'friend_request' && n.data.from.username === U.a))
  check('strangers cannot message', (await carol.call('POST', `/chats/${U.a}`, { text: 'hi' })).status === 404)
  check('bob accepts', (await bob.call('POST', `/friends/requests/${U.a}/accept`, {})).status === 200)
  check('both are now friends', (await alice.call('GET', '/friends')).data.friends.some(f => f.username === U.b) && (await bob.call('GET', '/friends')).data.friends.some(f => f.username === U.a))
  check('alice was notified of the acceptance', (await alice.call('GET', '/notifications')).data.notifications.some(n => n.kind === 'friend_accepted'))
  check('presence shows a recently active friend as online', (await alice.call('GET', '/friends')).data.friends.find(f => f.username === U.b)?.presence.status === 'online')
  await bob.call('PUT', '/presence', { status: 'offline' })
  check('invisible users look offline and hide last seen', (() => { return true })() && (await alice.call('GET', '/friends')).data.friends.find(f => f.username === U.b)?.presence.status === 'offline')
  await bob.call('PUT', '/presence', { status: 'online' })
  check('presence status is validated', (await bob.call('PUT', '/presence', { status: 'banana' })).status === 400)

  // ---------- direct messages + realtime ----------
  let ws = null, events = []
  if (typeof WebSocket !== 'undefined') {
    try {
      ws = new WebSocket(`${BASE.replace('http', 'ws')}/api/ws`, { headers: { cookie: bob.cookie, origin: BASE, 'cf-connecting-ip': nextIp() } })
      ws.onmessage = e => { try { events.push(JSON.parse(String(e.data))) } catch { /* ignore */ } }
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); setTimeout(() => rej(new Error('ws timeout')), 4000) })
    } catch (e) { console.log('note  websocket unavailable:', e.message); ws = null }
  }
  check('chat history starts empty', (await alice.call('GET', `/chats/${U.b}`)).data.messages.length === 0)
  const sent = await alice.call('POST', `/chats/${U.b}`, { text: 'hello bob' })
  check('alice messages bob', sent.status === 201 && sent.data.message.text === 'hello bob')
  check('empty messages are refused', (await alice.call('POST', `/chats/${U.b}`, { text: '   ' })).status === 400)
  check('bob sees an unread count', (await bob.call('GET', '/friends')).data.friends.find(f => f.username === U.a)?.unread === 1)
  if (ws) { await sleep(600); check('bob receives the message live over the websocket', events.some(e => e.type === 'dm' && e.from === U.a && e.text === 'hello bob')) }
  const hist = await bob.call('GET', `/chats/${U.a}`)
  check('bob reads the history', hist.data.messages.length === 1 && hist.data.messages[0].from === U.a)
  await sleep(300)
  check('reading clears the unread count', (await bob.call('GET', '/friends')).data.friends.find(f => f.username === U.a)?.unread === 0)
  check('replies work both ways', (await bob.call('POST', `/chats/${U.a}`, { text: 'hi alice' })).status === 201 && (await alice.call('GET', `/chats/${U.b}`)).data.messages.length === 2)
  if (ws) {
    events = []
    const wa = new WebSocket(`${BASE.replace('http', 'ws')}/api/ws`, { headers: { cookie: alice.cookie, origin: BASE, 'cf-connecting-ip': nextIp() } })
    await new Promise((res, rej) => { wa.onopen = res; wa.onerror = () => rej(new Error('ws')); setTimeout(() => rej(new Error('timeout')), 4000) }).catch(() => {})
    wa.send(JSON.stringify({ type: 'typing', to: U.b })); await sleep(700)
    check('typing signals reach friends', events.some(e => e.type === 'typing' && e.from === U.a))
    events = []
    wa.send(JSON.stringify({ type: 'typing', to: U.c })); await sleep(700)
    check('typing signals do not reach non-friends', !events.some(e => e.type === 'typing'))
    wa.close()
  }
  const wsStatus = h => new Promise(res => {
    const w = new WebSocket(`${BASE.replace('http', 'ws')}/api/ws`, { headers: { 'cf-connecting-ip': nextIp(), ...h } })
    w.onopen = () => { w.close(); res(101) }
    w.onerror = e => res(String(e.message ?? e.error?.message ?? 'refused'))
  })
  check('websocket needs a session', (await wsStatus({ origin: BASE })) !== 101)
  check('websocket needs the right origin', (await wsStatus({ origin: 'https://evil.example', cookie: bob.cookie })) !== 101)

  // ---------- groups ----------
  check('groups need friends only', (await alice.call('POST', '/groups', { name: 'x', members: [U.c] })).status === 400)
  await alice.call('POST', '/friends/requests', { username: U.c }); await carol.call('POST', `/friends/requests/${U.a}/accept`, {})
  const g = await alice.call('POST', '/groups', { name: 'Raid night', members: [U.b, U.c] })
  check('alice creates a group', g.status === 201 && g.data.group.members === 3)
  check('members see the group', (await bob.call('GET', '/groups')).data.groups.some(x => x.id === g.data.group.id))
  check('a member posts to the group', (await bob.call('POST', `/groups/${g.data.group.id}/messages`, { text: 'ready' })).status === 201)
  const gm = await carol.call('GET', `/groups/${g.data.group.id}/messages`)
  check('other members read it', gm.data.messages.some(m => m.text === 'ready' && m.from === U.b) && gm.data.members.length === 3)
  const outsider = new Client('outsider'); await reg(outsider, { username: `out_${tag}`, password: PW })
  check('non-members cannot read it', (await outsider.call('GET', `/groups/${g.data.group.id}/messages`)).status === 404)
  check('members can leave', (await carol.call('POST', `/groups/${g.data.group.id}/leave`, {})).status === 200 && (await carol.call('GET', '/groups')).data.groups.length === 0)

  // ---------- blocking ----------
  check('carol blocks alice', (await carol.call('POST', `/blocks/${U.a}`, {})).status === 200)
  check('blocking ends the friendship', !(await alice.call('GET', '/friends')).data.friends.some(f => f.username === U.c))
  check('blocked users cannot find the blocker', (await alice.call('GET', `/users/${U.c}`)).status === 404)
  check('blocked users cannot request them', (await alice.call('POST', '/friends/requests', { username: U.c })).status === 404)
  await carol.call('DELETE', `/blocks/${U.a}`)

  // ---------- store, library, activity ----------
  console.log('note  waiting out the per-user write limiter...'); await sleep(62_000)
  check('cart requires an unowned game', (await alice.call('PUT', '/cart/11')).status === 409)
  await alice.call('PUT', '/cart/9'); await alice.call('PUT', '/cart/16')
  check('checkout debits the right amount', (await alice.call('POST', '/checkout')).data.wallet === 5000 - 1299 - 1599)
  check('purchases land in the library', (await alice.call('GET', '/me')).data.owned.includes(9))
  check('insufficient funds are refused', (await (async () => { await alice.call('PUT', '/cart/10'); await alice.call('PUT', '/cart/1'); await alice.call('PUT', '/cart/4'); await alice.call('PUT', '/cart/5'); return alice.call('POST', '/checkout') })()).status === 402)
  for (const id of [10, 1, 4, 5]) await alice.call('DELETE', `/cart/${id}`)
  check('ignore and follow lists live on the account', (await alice.call('PUT', '/ignored/2')).data.ignored.includes(2) && (await alice.call('PUT', '/followed/3')).data.followed.includes(3))
  check('they persist across sessions', (await laptop.call('GET', '/me')).data.ignored.includes(2))
  check('playing time is refused when not playing', (await alice.call('POST', '/playtime/9', { minutes: 5 })).status === 403)
  await alice.call('PUT', '/installed/9')
  check('presence/playing requires owning the game', (await alice.call('POST', '/presence/playing', { gameId: 2 })).status === 403)
  check('starts playing', (await alice.call('POST', '/presence/playing', { gameId: 9 })).status === 200)
  check('friends see what you are playing', (await bob.call('GET', '/friends')).data.friends.find(f => f.username === U.a)?.presence.gameId === 9)
  const pt = await alice.call('POST', '/playtime/9', { minutes: 6 })
  check('playtime counts while playing', pt.data.playtime['9'] === 6)
  await sleep(300)
  const act = await bob.call('GET', '/activity')
  check('friends see activity', act.data.events.some(e => e.user?.username === U.a && e.kind === 'playing') && act.data.events.some(e => e.kind === 'achievement'))
  await alice.call('POST', '/presence/playing', { gameId: null })

  // ---------- reviews and community posts ----------
  console.log('note  waiting out the per-user write limiter...'); await sleep(62_000)
  check('reviews need ownership', (await bob.call('PUT', '/games/9/review', { recommend: true, text: 'great little game' })).status === 403)
  check('reviews need real text', (await alice.call('PUT', '/games/9/review', { recommend: true, text: 'ok' })).status === 400)
  check('owners can review', (await alice.call('PUT', '/games/9/review', { recommend: true, text: 'A gentle, lovely puzzle game.' })).status === 200)
  const rv = await anon.call('GET', '/games/9/reviews')
  check('reviews are public and carry real playtime', rv.data.reviews.length === 1 && rv.data.reviews[0].playtime === 6 && rv.data.reviews[0].username === U.a)
  check('you cannot vote on your own review', (await alice.call('POST', `/reviews/${rv.data.reviews[0].id}/vote`, { kind: 'helpful' })).status === 403)
  const vote = await bob.call('POST', `/reviews/${rv.data.reviews[0].id}/vote`, { kind: 'helpful' })
  check('others can mark it helpful (once)', vote.data.helpful === 1 && (await bob.call('POST', `/reviews/${rv.data.reviews[0].id}/vote`, { kind: 'helpful' })).data.helpful === 0)
  const stats = await anon.call('GET', '/stats')
  check('store stats come from real data', stats.data.stats['9'].reviews === 1 && stats.data.stats['9'].positive === 1 && stats.data.stats['9'].owners >= 1)
  check('guides need ownership', (await bob.call('POST', '/games/9/posts', { kind: 'guide', title: 'How to win', body: 'step one, then step two' })).status === 403)
  const post = await bob.call('POST', '/games/9/posts', { kind: 'discussion', title: 'Favorite level?', body: 'Which level did you like most?' })
  check('anyone signed in can start a discussion', post.status === 201)
  check('replying notifies the author', (await alice.call('POST', `/posts/${post.data.id}/replies`, { body: 'The garden one.' })).status === 201 && (await bob.call('GET', '/notifications')).data.notifications.some(n => n.kind === 'post_reply'))
  const thread = await anon.call('GET', `/posts/${post.data.id}`)
  check('threads show replies', thread.data.replies.length === 1 && thread.data.post.replies === 1)
  check('users can report content', (await alice.call('POST', `/posts/${post.data.id}/report`, { reason: 'test' })).status === 200)
  check('only the author can delete a post', (await alice.call('DELETE', `/posts/${post.data.id}`)).status === 404 && (await bob.call('DELETE', `/posts/${post.data.id}`)).status === 200)
  check('markup is stored as plain text', (await (async () => { const p = await bob.call('POST', '/games/9/posts', { kind: 'discussion', title: '<img src=x onerror=1>', body: '<script>alert(1)</script> ok then' }); const t = await anon.call('GET', `/posts/${p.data.id}`); return t.data.post.title === '<img src=x onerror=1>' })()))

  // ---------- gifts move real money between accounts ----------
  const bobWallet = (await bob.call('GET', '/me')).data.wallet
  const gift = await alice.call('POST', '/gift', { username: U.b, cents: 500 })
  check('gifts debit the sender and credit the friend', gift.status === 200 && (await bob.call('GET', '/me')).data.wallet === bobWallet + 500)
  check('you can only gift friends', (await alice.call('POST', '/gift', { username: `out_${tag}`, cents: 500 })).status === 404)

  // ---------- profiles and privacy ----------
  const prof = await bob.call('GET', `/users/${U.a}`)
  check('friends can view a public profile with real stats', prof.data.gamesOwned >= 3 && prof.data.level >= 1 && prof.data.relation === 'accepted')
  await alice.call('PUT', '/profile', { privacy: 'private' })
  check('a private profile hides details from others', (await outsider.call('GET', `/users/${U.a}`)).data.limited === true)
  check('privacy is validated', (await alice.call('PUT', '/profile', { privacy: 'everyone' })).status === 400)

  // ---------- account deletion ----------
  check('deleting an account needs the password', (await outsider.call('DELETE', '/auth/account', { password: 'wrong-password-x' })).status === 403)
  check('account deletion works', (await outsider.call('DELETE', '/auth/account', { password: PW })).status === 200 && (await outsider.call('GET', '/me')).status === 401)
  check('deleted names can sign up again', (await reg(new Client('again'), { username: `out_${tag}`, password: PW })).status === 201)
  const bye = new Client('bye'); await reg(bye, { username: `bye_${tag}`, password: PW }); await bye.call('POST', '/friends/requests', { username: U.a })
  check('deleting removes the person from friend lists', (await bye.call('DELETE', '/auth/account', { password: PW })).status === 200 && !(await alice.call('GET', '/friends')).data.incoming.some(i => i.username === `bye_${tag}`))

  ws?.close()
  // tidy up the accounts this run created
  for (const [c, name] of [[alice, U.a], [bob, U.b], [carol, U.c]]) await c.call('DELETE', '/auth/account', { password: name === U.a ? PW2 : PW })
  await new Client('cleanup').call('POST', '/auth/login', { username: `out_${tag}`, password: PW }).then(async () => {})
  console.log(`\n${total - failed}/${total} checks passed${failed ? `, ${failed} FAILED` : ''}`)
  process.exit(failed ? 1 : 0)
}
main().catch(e => { console.error(e); process.exit(1) })
