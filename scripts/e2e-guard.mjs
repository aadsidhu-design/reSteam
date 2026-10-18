// reGuard (authenticator-app second factor), backup codes, device list and the security log.
// Run with the API up: BASE=http://localhost:8787 node scripts/e2e-guard.mjs
import { createHmac } from 'node:crypto'

const BASE = process.env.BASE ?? 'http://localhost:8787'
let pass = 0, fail = 0
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name} ${ok ? '' : extra}`) }
const H = { 'x-requested-with': 'fetch', origin: BASE, 'content-type': 'application/json' }

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function unbase32(s) { let bits = 0, v = 0; const out = []; for (const ch of s) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8 } } return Buffer.from(out) }
function totp(secret, step) {
  const msg = Buffer.alloc(8); msg.writeUInt32BE(Math.floor(step / 2 ** 32), 0); msg.writeUInt32BE(step >>> 0, 4)
  const h = createHmac('sha1', unbase32(secret)).update(msg).digest()
  const o = h[h.length - 1] & 15
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000).padStart(6, '0')
}
const step = () => Math.floor(Date.now() / 30000)

async function req(method, path, body, cookie) {
  const res = await fetch(`${BASE}/api${path}`, { method, headers: { ...H, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, data: await res.json().catch(() => null), cookie: res.headers.get('set-cookie')?.split(';')[0] ?? null }
}

const username = `gd_${Math.random().toString(36).slice(2, 8)}`, password = 'correct-horse-9'
const reg = await req('POST', '/auth/register', { username, password })
const cookie = reg.cookie
check('register', reg.status === 201 && !!cookie)

check('guard starts off', (await req('GET', '/auth/guard', null, cookie)).data?.enabled === false)
check('enabling before setup is refused', (await req('POST', '/auth/guard/enable', { code: '123456' }, cookie)).status === 400)
const setup = await req('POST', '/auth/guard/setup', null, cookie)
check('setup returns a base32 secret and an otpauth link', /^[A-Z2-7]{32}$/.test(setup.data?.secret ?? '') && setup.data?.uri?.startsWith('otpauth://totp/'))
check('a wrong code does not enable it', (await req('POST', '/auth/guard/enable', { code: '000000' }, cookie)).status === 400)
const en = await req('POST', '/auth/guard/enable', { code: totp(setup.data.secret, step()) }, cookie)
check('the right code enables it and returns 8 backup codes', en.status === 200 && en.data.backupCodes?.length === 8)
const backups = en.data.backupCodes
const st = await req('GET', '/auth/guard', null, cookie)
check('status shows on with 8 backup codes left', st.data?.enabled === true && st.data?.backupCodesLeft === 8)
check('setup is refused while it is on', (await req('POST', '/auth/guard/setup', null, cookie)).status === 409)

const noCode = await req('POST', '/auth/login', { username, password })
check('a correct password alone asks for a code and sets no cookie', noCode.status === 200 && noCode.data?.guard === true && !noCode.cookie)
check('a wrong password still looks like any other failure', (await req('POST', '/auth/login', { username, password: 'nope-nope-1' })).status === 401)
check('a wrong code is refused', (await req('POST', '/auth/login', { username, password, code: '000000' })).status === 401)
const code = totp(setup.data.secret, step() + 1) // one step ahead is inside the drift window and newer than the code used to enable
const ok = await req('POST', '/auth/login', { username, password, code })
check('the right code signs in', ok.status === 200 && !!ok.cookie)
check('the same code cannot be used twice', (await req('POST', '/auth/login', { username, password, code })).status === 401)

const bk = await req('POST', '/auth/login', { username, password, code: backups[0] })
check('a backup code signs in', bk.status === 200 && !!bk.cookie)
check('a backup code works only once', (await req('POST', '/auth/login', { username, password, code: backups[0] })).status === 401)
check('using one leaves 7', (await req('GET', '/auth/guard', null, bk.cookie)).data?.backupCodesLeft === 7)

const sessions = await req('GET', '/auth/sessions', null, bk.cookie)
check('devices list marks the current one', sessions.data?.sessions?.some(s => s.current) && sessions.data.sessions.length >= 2)
const other = sessions.data.sessions.find(s => !s.current)
check('a device id is not the session secret', other.id.length === 16)
check('you cannot sign out the device you are using that way', (await req('DELETE', `/auth/sessions/${sessions.data.sessions.find(s => s.current).id}`, null, bk.cookie)).status === 404)
check('another device can be signed out', (await req('DELETE', `/auth/sessions/${other.id}`, null, bk.cookie)).status === 200)
check('and that device stops working', (await req('GET', '/auth/me', null, cookie)).status === 401 || (await req('GET', '/auth/me', null, ok.cookie)).status === 401)
const rev = await req('POST', '/auth/sessions/revoke-others', null, bk.cookie)
check('sign out everywhere else works', rev.status === 200)
check('the current device survives it', (await req('GET', '/auth/me', null, bk.cookie)).status === 200)

const ev = await req('GET', '/auth/events', null, bk.cookie)
const kinds = new Set((ev.data?.events ?? []).map(e => e.kind))
check('the security log records sign-ins, failures and changes', ['login', 'guard_failed', 'guard_on', 'sessions_revoked'].every(k => kinds.has(k)), [...kinds].join(','))

check('turning it off needs the password', (await req('POST', '/auth/guard/disable', { password: 'wrong-wrong-1', code: backups[1] }, bk.cookie)).status === 403)
check('turning it off needs a valid code', (await req('POST', '/auth/guard/disable', { password, code: '000000' }, bk.cookie)).status === 403)
check('password and a backup code turn it off', (await req('POST', '/auth/guard/disable', { password, code: backups[1] }, bk.cookie)).status === 200)
check('sign-in no longer asks for a code', (await req('POST', '/auth/login', { username, password })).data?.user?.username === username)
check('backup codes are gone', (await req('GET', '/auth/guard', null, bk.cookie)).data?.backupCodesLeft === 0)
check('deleting the account cleans up the guard data', (await req('DELETE', '/auth/account', { password }, bk.cookie)).status === 200)

console.log(`\n${pass}/${pass + fail} checks passed${fail ? `, ${fail} FAILED` : ''}`)
process.exit(fail ? 1 : 0)
