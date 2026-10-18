// Moderation flow. Start the API with `npm run api:test` first (it makes `e2e_admin` a moderator and turns approval on).
import { zipSync, strToU8 } from 'fflate'
const BASE = process.env.BASE ?? 'http://localhost:8787'
let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name} ${ok ? '' : extra}`) }
const h = { 'x-requested-with': 'fetch', origin: BASE, 'content-type': 'application/json' }

async function account(username) {
  let r = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: h, body: JSON.stringify({ username, password: 'correct-horse-9' }) })
  if (r.status !== 201) r = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: h, body: JSON.stringify({ username, password: 'correct-horse-9' }) })
  const cookie = r.headers.get('set-cookie').split(';')[0]
  const call = async (method, path, body) => {
    const isRaw = body instanceof Uint8Array
    const res = await fetch(`${BASE}/api${path}`, { method, headers: { ...h, cookie, ...(isRaw ? { 'content-type': 'application/octet-stream' } : {}) }, body: body ? (isRaw ? body : JSON.stringify(body)) : undefined })
    const ct = res.headers.get('content-type') ?? ''
    return { status: res.status, data: ct.includes('json') ? await res.json() : null }
  }
  return { username, call }
}
const rand = Math.random().toString(36).slice(2, 7)
const admin = await account('e2e_admin'), dev = await account(`mdev_${rand}`), other = await account(`mother_${rand}`)

check('moderators are identified by the server setting', (await admin.call('GET', '/admin/me')).data.admin === true)
check('ordinary users are not moderators', (await dev.call('GET', '/admin/me')).data.admin === false)
check('the moderation overview is closed to others', (await dev.call('GET', '/admin/overview')).status === 403)

const meta = { title: 'Review Me', blurb: 'A game waiting for review by a moderator.', genre: ['Puzzle'], tags: ['Test'], price: 0 }
const gid = (await dev.call('POST', '/dev/games', meta)).data.id
await dev.call('PUT', `/dev/games/${gid}/web`, zipSync({ 'index.html': strToU8('<p>hi</p>') }))
const pub = await dev.call('POST', `/dev/games/${gid}/publish`)
check('with approval on, publishing waits for review', pub.status === 200 && pub.data.status === 'pending')
check('a pending game is not in the catalog', !(await fetch(`${BASE}/api/games`).then(r => r.json())).some(g => g.id === gid))
const ov = (await admin.call('GET', '/admin/overview')).data
check('moderators see the pending game', ov.pending.some(p => p.id === gid))
check('others cannot approve', (await other.call('POST', `/admin/games/${gid}/approve`)).status === 403)
check('a moderator can approve it', (await admin.call('POST', `/admin/games/${gid}/approve`)).status === 200)
check('an approved game is in the catalog', (await fetch(`${BASE}/api/games`).then(r => r.json())).some(g => g.id === gid))
await new Promise(r => setTimeout(r, 500))
check('the owner is told', (await dev.call('GET', '/notifications')).data.notifications.some(n => n.kind === 'game_approved'))

await other.call('POST', `/games/${gid}/report`, { reason: 'looks wrong' })
const rep = (await admin.call('GET', '/admin/overview')).data.reports.find(r => r.target === `game:${gid}`)
check('reports reach the moderators', !!rep && rep.reporter === other.username)
check('a report can be dismissed', (await admin.call('POST', `/admin/reports/${rep.id}/dismiss`)).status === 200 && !(await admin.call('GET', '/admin/overview')).data.reports.some(r => r.id === rep.id))

check('a takedown needs a reason', (await admin.call('POST', `/admin/games/${gid}/takedown`, { reason: '' })).status === 400)
check('a moderator can take a game down', (await admin.call('POST', `/admin/games/${gid}/takedown`, { reason: 'Breaks the rules' })).status === 200)
check('a taken-down game leaves the catalog', !(await fetch(`${BASE}/api/games`).then(r => r.json())).some(g => g.id === gid))
await new Promise(r => setTimeout(r, 500))
check('the owner sees the reason', (await dev.call('GET', '/notifications')).data.notifications.some(n => n.kind === 'game_removed' && /Breaks the rules/.test(n.data.reason)))
const adminGame = (await admin.call('POST', '/dev/games', meta)).data.id
await admin.call('PUT', `/dev/games/${adminGame}/web`, zipSync({ 'index.html': strToU8('<p>hi</p>') }))
check('moderators publish without waiting', (await admin.call('POST', `/dev/games/${adminGame}/publish`)).data.status === 'published')
await admin.call('DELETE', `/dev/games/${adminGame}`)
await dev.call('DELETE', `/dev/games/${gid}`)
for (const u of [dev, other]) await u.call('DELETE', '/auth/account', { password: 'correct-horse-9' })
console.log(`\n${pass}/${pass + fail} checks passed${fail ? `, ${fail} FAILED` : ''}`)
process.exit(fail ? 1 : 0)
