// Upload flow: create, upload (web zip + build + cover), publish, play token, download, permissions, cleanup.
// Run with the API up: BASE=http://localhost:8787 node scripts/e2e-games.mjs
import { zipSync, strToU8 } from 'fflate'

const BASE = process.env.BASE ?? 'http://localhost:8787'
let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name} ${ok ? '' : extra}`) }

async function account(name) {
  const h = { 'x-requested-with': 'fetch', origin: BASE }
  const username = `${name}_${Math.random().toString(36).slice(2, 7)}`
  const r = await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ username, password: 'correct-horse-9' }) })
  const cookie = r.headers.get('set-cookie').split(';')[0]
  const call = async (method, path, body, extra = {}) => {
    const isRaw = body instanceof Uint8Array
    const res = await fetch(`${BASE}/api${path}`, { method, headers: { ...h, cookie, ...(body && !isRaw ? { 'content-type': 'application/json' } : {}), ...extra }, body: body ? (isRaw ? body : JSON.stringify(body)) : undefined })
    const ct = res.headers.get('content-type') ?? ''
    return { status: res.status, res, data: ct.includes('json') ? await res.json() : null }
  }
  return { username, call, cookie }
}

const dev = await account('dev'), other = await account('buyer')
const meta = { title: 'Pixel Pond', blurb: 'A tiny pond simulator you can play in the browser.', genre: ['Casual', 'Indie'], tags: ['Relaxing', 'Pixel'], price: 0 }

check('guests cannot create games', (await fetch(`${BASE}/api/dev/games`, { method: 'POST', headers: { 'x-requested-with': 'fetch', 'content-type': 'application/json' }, body: '{}' })).status === 401)
check('bad metadata is refused', (await dev.call('POST', '/dev/games', { ...meta, genre: ['Nope'] })).status === 400)
check('prices are capped', (await dev.call('POST', '/dev/games', { ...meta, price: 99999999 })).status === 400)
const created = await dev.call('POST', '/dev/games', meta)
check('a game can be created as a draft', created.status === 201 && created.data.id >= 1000)
const id = created.data.id

const list0 = await fetch(`${BASE}/api/games`).then(r => r.json())
check('drafts are not in the public catalog', !list0.some(g => g.id === id))
check('drafts cannot be added to a cart', (await other.call('PUT', `/cart/${id}`)).status === 404)
check('publishing needs a build', (await dev.call('POST', `/dev/games/${id}/publish`)).status === 400)
check('others cannot upload to my game', (await other.call('PUT', `/dev/games/${id}/web`, new Uint8Array([1, 2, 3]))).status === 404)

const goodZip = zipSync({ 'pond/index.html': strToU8('<!doctype html><title>pond</title><script src="game.js"></script>'), 'pond/game.js': strToU8('document.title="played"') })
check('a zip with a wrapping folder is accepted', (await dev.call('PUT', `/dev/games/${id}/web`, goodZip)).status === 200)
check('a zip without index.html is refused', (await dev.call('PUT', `/dev/games/${id}/web`, zipSync({ 'a.txt': strToU8('x') }))).status === 400)
check('path traversal in a zip is refused', (await dev.call('PUT', `/dev/games/${id}/web`, zipSync({ 'index.html': strToU8('x'), '../evil.js': strToU8('x') }))).status === 400)
check('a non-zip is refused', (await dev.call('PUT', `/dev/games/${id}/web`, new Uint8Array(500).fill(7))).status === 400)
await dev.call('PUT', `/dev/games/${id}/web`, goodZip)

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(40).fill(0)])
check('covers must really be images', (await dev.call('PUT', `/dev/games/${id}/cover`, strToU8('<script>alert(1)</script>'))).status === 415)
check('a png cover is accepted', (await dev.call('PUT', `/dev/games/${id}/cover`, png)).status === 200)
const cover = await fetch(`${BASE}/api/games/${id}/cover`)
check('the cover is served as an image, sandboxed', cover.status === 200 && cover.headers.get('content-type') === 'image/png' && /sandbox/.test(cover.headers.get('content-security-policy') ?? ''))

check('screenshots must be real images', (await dev.call('PUT', `/dev/games/${id}/shots/0`, strToU8('<svg onload=alert(1)>'))).status === 415)
check('screenshots must be uploaded in order', (await dev.call('PUT', `/dev/games/${id}/shots/3`, png)).status === 400)
check('screenshots upload', (await dev.call('PUT', `/dev/games/${id}/shots/0`, png)).status === 200 && (await dev.call('PUT', `/dev/games/${id}/shots/1`, png)).status === 200)
const shot = await fetch(`${BASE}/api/games/${id}/shots/1`)
check('screenshots are served sandboxed as images', shot.status === 200 && shot.headers.get('content-type') === 'image/png' && /sandbox/.test(shot.headers.get('content-security-policy') ?? ''))
check('others cannot add screenshots', (await other.call('PUT', `/dev/games/${id}/shots/2`, png)).status === 404)

const buildBytes = new Uint8Array(200_000).map((_, i) => i % 251)
check('a downloadable build is accepted', (await dev.call('PUT', `/dev/games/${id}/build?name=${encodeURIComponent('pond-1.0.zip')}`, buildBytes)).status === 200)
check('a build over the limit is refused', (await dev.call('PUT', `/dev/games/${id}/build`, new Uint8Array(51 * 1024 * 1024))).status === 413)

check('achievements are validated', (await dev.call('PUT', `/dev/games/${id}`, { ...meta, achievements: 99 })).status === 400)
check('a developer can define achievements', (await dev.call('PUT', `/dev/games/${id}`, { ...meta, achievements: 12 })).status === 200)
check('discounts are bounded', (await dev.call('PUT', `/dev/games/${id}/discount`, { percent: 95 })).status === 400)
check('only the owner can set a discount', (await other.call('PUT', `/dev/games/${id}/discount`, { percent: 10 })).status === 404)
const ch = await fetch(`${BASE}/api/charts`).then(r => r.json())
check('chart rows carry rank, movement and weeks', ch.topselling.every((r, i) => r.rank === i + 1 && 'change' in r && r.weeks >= 1))
check('charts expose ranked lists from real activity', ['topselling', 'mostplayed', 'wishlisted', 'new'].every(k => Array.isArray(ch[k])) && ch.topselling.every((r, i, a) => i === 0 || a[i - 1].value >= r.value))
check('publishing works', (await dev.call('POST', `/dev/games/${id}/publish`)).status === 200)
check('wishlisting works', (await other.call('PUT', `/wishlist/${id}`)).status === 200)
check('following works', (await other.call('PUT', `/followed/${id}`)).status === 200)
check('a sale can be started', (await dev.call('PUT', `/dev/games/${id}/discount`, { percent: 25 })).status === 200)
check('news needs a real post', (await dev.call('POST', `/dev/games/${id}/news`, { title: 'x', body: 'y' })).status === 400)
check('only the owner can post news', (await other.call('POST', `/dev/games/${id}/news`, { title: 'Patch 1.1', body: 'Fixed the pond ripples.' })).status === 404)
const nw = await dev.call('POST', `/dev/games/${id}/news`, { title: 'Patch 1.1', body: 'Fixed the pond ripples and added fish.' })
check('the owner can post news', nw.status === 201)
check('news is public', (await fetch(`${BASE}/api/games/${id}/news`).then(r => r.json())).news.some(n => n.title === 'Patch 1.1'))
await new Promise(r => setTimeout(r, 600))
const notes = (await other.call('GET', '/notifications')).data.notifications.map(n => n.kind)
check('wishlisters hear about the sale', notes.includes('wishlist_sale'))
check('followers hear about the news', notes.includes('game_news'))
const pub = (await fetch(`${BASE}/api/games`).then(r => r.json())).find(g => g.id === id)
check('the published game is in the public catalog with its files', pub && pub.playable && pub.hasCover && pub.build?.name === 'pond-1.0.zip' && pub.owner === dev.username && pub.released.length === 10 && pub.discount === 25 && pub.achievements === 12)

check('downloads need ownership', (await other.call('GET', `/games/${id}/download`)).status === 403)
check('play links need ownership', (await other.call('POST', `/games/${id}/play-token`)).status === 403)
check('a free game can be claimed', (await other.call('POST', `/claim/${id}`)).status === 200)

const dl = await other.call('GET', `/games/${id}/download`)
const got = new Uint8Array(await dl.res.arrayBuffer())
check('owners download the exact bytes', dl.status === 200 && got.length === buildBytes.length && got.every((b, i) => b === buildBytes[i]) && /attachment/.test(dl.res.headers.get('content-disposition') ?? ''))

const tok = await other.call('POST', `/games/${id}/play-token`)
check('owners get a play link', tok.status === 200 && tok.data.url.startsWith(`/play/${id}/`))
const play = await fetch(BASE + tok.data.url)
const csp = play.headers.get('content-security-policy') ?? ''
check('the game page loads, sandboxed with no same-origin', play.status === 200 && /sandbox allow-scripts/.test(csp) && !/allow-same-origin/.test(csp) && /text\/html/.test(play.headers.get('content-type')))
const js = await fetch(BASE + tok.data.url.replace('index.html', 'game.js'))
check('game assets load from the same token path', js.status === 200 && /javascript/.test(js.headers.get('content-type')))
check('a wrong token is refused', (await fetch(BASE + tok.data.url.replace(/\/[^/]{20,}\//, '/AAAAAAAAAAAAAAAAAAAAAAAA/'))).status === 403)
check('missing files are 404', (await fetch(BASE + tok.data.url.replace('index.html', 'nope.js'))).status === 404)
check('traversal outside the game is refused', (await fetch(BASE + tok.data.url.replace('index.html', '%2e%2e%2fother'))).status >= 400)

check('only the owner can edit', (await other.call('PUT', `/dev/games/${id}`, meta)).status === 404)
check('the owner can edit', (await dev.call('PUT', `/dev/games/${id}`, { ...meta, title: 'Pixel Pond 2' })).status === 200)
check('unpublish hides it', (await dev.call('POST', `/dev/games/${id}/unpublish`)).status === 200 && !(await fetch(`${BASE}/api/games`).then(r => r.json())).some(g => g.id === id))
check('only the owner can delete', (await other.call('DELETE', `/dev/games/${id}`)).status === 404)
check('the owner can delete', (await dev.call('DELETE', `/dev/games/${id}`)).status === 200)
check('deleting removes it from owners’ libraries', !(await other.call('GET', '/me')).data.owned.includes(id))
check('deleted play links stop working', (await fetch(BASE + tok.data.url)).status === 403)

check('deleting an account removes its games', await (async () => {
  const g = (await dev.call('POST', '/dev/games', meta)).data.id
  await dev.call('PUT', `/dev/games/${g}/web`, goodZip)
  const r = await dev.call('DELETE', '/auth/account', { password: 'correct-horse-9' })
  return r.status === 200 && !(await (await fetch(`${BASE}/api/games`)).json()).some(x => x.id === g)
})())
await other.call('DELETE', '/auth/account', { password: 'correct-horse-9' })
console.log(`\n${pass}/${pass + fail} checks passed${fail ? `, ${fail} FAILED` : ''}`)
process.exit(fail ? 1 : 0)
