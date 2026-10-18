// Builds docs/coverage.svg (poster), docs/coverage.md (every row) and docs/coverage.json.
// Everything countable is read from the code: API routes and which of them the e2e suites exercise, client routes,
// translation tables, test checks and source size. Fidelity scores and the evidence log are recorded by hand in fidelity.ts.
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { BACKEND, CLIENT } from '../features.ts'
import { EVIDENCE, PAGES } from './fidelity.ts'

const root = new URL('../../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, root), 'utf8')
const ls = (d: string) => readdirSync(new URL(d, root))

// ---------------------------------------------------------------- API inventory
interface Endpoint { method: string; path: string; area: string; auth: boolean; write: boolean; tested: boolean }
const AREA: Record<string, string> = { 'auth.ts': 'Accounts', 'social.ts': 'Friends, chat, presence', 'community.ts': 'Community and stats', 'shop.ts': 'Store, cart, library', 'dev.ts': 'Publishing and files' }
const e2eText = ['scripts/e2e.mjs', 'scripts/e2e-games.mjs', 'scripts/e2e-extra.mjs', 'scripts/e2e-admin.mjs'].map(read).join('\n')
const calls: { m: string; p: string }[] = []
for (const m of e2eText.matchAll(/call\('(GET|POST|PUT|DELETE)',\s*([`'"])((?:(?!\2).)+)\2/g)) calls.push({ m: m[1], p: m[3].replace(/\$\{[^}]*\}/g, 'X').split('?')[0] })
for (const m of e2eText.matchAll(/fetch\(`\$\{BASE\}\/api([^`]*)`(?:,\s*\{[^}]*method:\s*'(GET|POST|PUT|DELETE)')?/g)) calls.push({ m: m[2] ?? 'GET', p: m[1].replace(/\$\{[^}]*\}/g, 'X').split('?')[0] })
for (const m of e2eText.matchAll(/api\(`?['"]?\/?([^`'"]*)/g)) void m
const endpoints: Endpoint[] = []
for (const f of ls('worker/')) {
  if (!AREA[f]) continue
  const src = read(`worker/${f}`)
  for (const m of src.matchAll(/route\('(GET|POST|PUT|DELETE)',\s*'([^']+)',\s*\{([^}]*)\}/g)) {
    const [, method, path, opts] = m
    const re = new RegExp('^' + path.replace(/:[A-Za-z]+/g, '[^/]+') + '$')
    endpoints.push({
      method, path, area: AREA[f], auth: !/auth:\s*false/.test(opts), write: method !== 'GET' && !/write:\s*false/.test(opts),
      tested: calls.some(c => c.m === method && re.test(c.p)),
    })
  }
}
const areas = [...new Set(endpoints.map(e => e.area))]

// ---------------------------------------------------------------- client routes, tests, size
const routes = [...read('src/App.tsx').matchAll(/<Route path="([^"]+)"/g)].map(m => m[1]).filter(p => p !== '*')
const checks = (e2eText.match(/\bcheck\(/g) ?? []).length
const loc = (dir: string, ext: RegExp) => ls(dir).filter(f => ext.test(f)).reduce((n, f) => n + read(`${dir}${f}`).split('\n').length, 0)
const sizes = { 'React and TS (src)': loc('src/', /\.tsx?$/), 'CSS': loc('src/', /\.css$/), 'Worker (API)': loc('worker/', /\.ts$/), 'SQL migrations': loc('migrations/', /\.sql$/) }
const dbTables = new Set(ls('migrations/').flatMap(f => [...read(`migrations/${f}`).matchAll(/CREATE TABLE (\w+)/g)].map(m => m[1]))).size

// ---------------------------------------------------------------- translations
// The tables are TypeScript source, so read their keys as text rather than importing them.
const i18nSrc = read('src/i18n.ts')
const keysIn = (block: string) => new Set([...block.matchAll(/'([a-z]+\.[a-z]+)':/g)].map(m => m[1]))
const enBlock = i18nSrc.slice(i18nSrc.indexOf('const en: Dict = {'), i18nSrc.indexOf('const T: Record<Lang, Dict> = {'))
const tBlock = i18nSrc.slice(i18nSrc.indexOf('const T: Record<Lang, Dict> = {'))
const coreKeys: Record<string, Set<string>> = { english: keysIn(enBlock) }
for (const m of tBlock.matchAll(/\n  (\w+): \{([\s\S]*?)\n  \},/g)) coreKeys[m[1]] = keysIn(m[2])
const rowsSrc = read('src/i18n.pages.ts')
const rows: string[][] = new Function(`return [${rowsSrc.slice(rowsSrc.indexOf('const ROWS: Row[] = [') + 21, rowsSrc.indexOf('\n]\n'))}\n]`)()
const ORDER = ['english', 'spanish', 'french', 'german', 'italian', 'brazilian', 'japanese', 'koreana', 'schinese', 'russian', 'turkish', 'polish']
const NAMES: Record<string, string> = { english: 'English', spanish: 'Spanish', french: 'French', german: 'German', italian: 'Italian', brazilian: 'Portuguese (Brazil)', japanese: 'Japanese', koreana: 'Korean', schinese: 'Chinese (Simplified)', russian: 'Russian', turkish: 'Turkish', polish: 'Polish' }
const english = new Set([...coreKeys.english, ...rows.map(r => r[0])])
const langRows = ORDER.map((code, i) => {
  const have = new Set([...(coreKeys[code] ?? []), ...rows.filter(r => r[i + 1]).map(r => r[0])])
  return { code, name: NAMES[code], have: [...english].filter(k => have.has(k)).length, total: english.size }
}).sort((a, b) => b.have - a.have || a.name.localeCompare(b.name))

// How much of each screen's text goes through t(): translated call sites vs hard-coded literals (a heuristic, not a proof).
const textCoverage = ls('src/').filter(f => /\.tsx$/.test(f) && !/^(main|art|icons)\./.test(f)).map(f => {
  const src = read(`src/${f}`)
  const translated = (src.match(/\btr?\(/g) ?? []).length
  const literals = (src.match(/>\s*[A-Z][A-Za-z][^<>{}\n]{2,}\s*</g) ?? []).length + (src.match(/(placeholder|title|aria-label)="[A-Za-z][^"]{3,}"/g) ?? []).length
  return { file: f, translated, literals, pct: translated + literals ? (translated / (translated + literals)) * 100 : 100 }
}).filter(r => r.translated + r.literals > 0).sort((a, b) => a.pct - b.pct)
const textTranslated = textCoverage.reduce((n, r) => n + r.translated, 0), textLiterals = textCoverage.reduce((n, r) => n + r.literals, 0)

// ---------------------------------------------------------------- features
type S = 'd' | 'p' | 'm'
const parse = (g: Record<string, string[]>) => Object.entries(g).map(([name, items]) => ({
  name, leaves: items.map(i => { const k = i.lastIndexOf(':'); return { name: i.slice(0, k), s: i.slice(k + 1) as S } }).sort((a, b) => 'dpm'.indexOf(a.s) - 'dpm'.indexOf(b.s)),
}))
const client = parse(CLIENT), backend = parse(BACKEND)
const tally = (g: ReturnType<typeof parse>) => { const a = g.flatMap(x => x.leaves); return { d: a.filter(l => l.s === 'd').length, p: a.filter(l => l.s === 'p').length, m: a.filter(l => l.s === 'm').length, n: a.length } }
const ct = tally(client), bt = tally(backend)
const weighted = (t: { d: number; p: number; n: number }) => ((t.d + t.p * 0.5) / t.n) * 100
const compared = PAGES.filter(p => p.visual !== null)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const visualAvg = avg(compared.map(p => p.visual!)), behaviorAvg = avg(compared.map(p => p.behavior!))
const tested = endpoints.filter(e => e.tested).length
let commit = 'working tree'
try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim() } catch { /* not a git checkout */ }
const today = new Date().toISOString().slice(0, 10)

// ---------------------------------------------------------------- rendering helpers
const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
type Rect = { x: number; y: number; w: number; h: number }
const COLOR = { d: '#3b9d3b', p: '#a3a23a', m: '#6b6e77' }
function squarify(items: { v: number }[], r: Rect): Rect[] {
  const total = items.reduce((n, i) => n + i.v, 0)
  const out: Rect[] = new Array(items.length)
  const idx = items.map((_, i) => i).sort((a, b) => items[b].v - items[a].v)
  let { x, y, w, h } = r
  let rest = total, i = 0
  const worst = (row: number[], side: number, scale: number) => {
    const s = row.reduce((n, k) => n + items[k].v, 0) * scale
    let mx = 0, mn = Infinity
    for (const k of row) { const a = items[k].v * scale; mx = Math.max(mx, a); mn = Math.min(mn, a) }
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn))
  }
  while (i < idx.length) {
    const side = Math.min(w, h), scale = (w * h) / rest
    const row = [idx[i]]
    let j = i + 1
    while (j < idx.length && worst([...row, idx[j]], side, scale) <= worst(row, side, scale)) row.push(idx[j++])
    const thick = (row.reduce((n, k) => n + items[k].v, 0) * scale) / side
    let off = 0
    for (const k of row) {
      const len = (items[k].v * scale) / thick
      out[k] = w >= h ? { x, y: y + off, w: thick, h: len } : { x: x + off, y, w: len, h: thick }
      off += len
    }
    if (w >= h) { x += thick; w -= thick } else { y += thick; h -= thick }
    rest -= row.reduce((n, k) => n + items[k].v, 0)
    i = j
  }
  return out
}

function treemap(groups: ReturnType<typeof parse>, r: Rect): string {
  let svg = ''
  const rects = squarify(groups.map(g => ({ v: g.leaves.length })), r)
  groups.forEach((g, gi) => {
    const q = rects[gi], pad = 1.5
    const cols = Math.max(1, Math.round(Math.sqrt((g.leaves.length * q.w) / q.h)))
    const rows = Math.ceil(g.leaves.length / cols)
    const ch = (q.h - pad * 2) / rows
    svg += `<g><rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="#0b1a0e" stroke="#0b1a0e" stroke-width="3"/>`
    g.leaves.forEach((l, li) => {
      const row = Math.floor(li / cols), inRow = row === rows - 1 ? g.leaves.length - (rows - 1) * cols : cols
      const cw = (q.w - pad * 2) / inRow
      svg += `<rect x="${(q.x + pad + (li - row * cols) * cw).toFixed(1)}" y="${(q.y + pad + row * ch).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="${COLOR[l.s]}" stroke="#14301a" stroke-width="0.8"><title>${esc(l.name)} (${l.s === 'd' ? 'replicated' : l.s === 'p' ? 'partial' : 'not yet'})</title></rect>`
    })
    const gd = g.leaves.filter(l => l.s === 'd').length
    svg += `<text x="${q.x + 7}" y="${q.y + 18}" class="lbl">${esc(g.name)}</text><text x="${q.x + 7}" y="${q.y + 33}" class="sub">${gd}/${g.leaves.length} · ${Math.round((gd / g.leaves.length) * 100)}%</text></g>`
  })
  return svg
}

const bar = (x: number, y: number, w: number, h: number, pct: number, fill: string, back = '#1b222c') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${back}"/><rect x="${x}" y="${y}" width="${Math.max(0, (w * pct) / 100).toFixed(1)}" height="${h}" rx="3" fill="${fill}"/>`
const scoreColor = (v: number) => (v >= 85 ? '#3b9d3b' : v >= 70 ? '#7aa63a' : v >= 55 ? '#b9a73a' : '#c27a3a')

// ---------------------------------------------------------------- poster
const W = 1600
let y = 0
let body = ''
const section = (title: string, sub?: string) => { y += 34; body += `<text x="30" y="${y}" class="h2">${esc(title)}</text>${sub ? `<text x="30" y="${y + 18}" class="leg">${esc(sub)}</text>` : ''}`; y += sub ? 30 : 16 }

body += `<text x="30" y="46" class="h1">reSteam replication coverage</text><text x="30" y="68" class="leg">Generated ${today} from commit ${esc(commit)}. Counts are read from the code; fidelity scores come from side-by-side captures of the real store. Run npm run coverage to refresh.</text>`
y = 92
const kpis: [string, string, string][] = [
  ['Features replicated', `${(((ct.d + bt.d) / (ct.n + bt.n)) * 100).toFixed(1)}%`, `${ct.d + bt.d} of ${ct.n + bt.n} behaviors (${weighted({ d: ct.d + bt.d, p: ct.p + bt.p, n: ct.n + bt.n }).toFixed(1)}% counting partial)`],
  ['Visual fidelity', `${visualAvg.toFixed(0)}/100`, `average over ${compared.length} pages compared with the real store`],
  ['Behavior fidelity', `${behaviorAvg.toFixed(0)}/100`, `${PAGES.filter(p => p.method === 'not-compared').length} pages still to compare`],
  ['API endpoints', `${endpoints.length}`, `${tested} exercised by e2e tests (${Math.round((tested / endpoints.length) * 100)}%)`],
  ['Automated checks', `${checks}`, 'end-to-end assertions over accounts, social, uploads'],
  ['Languages', `${langRows.length}`, `${english.size} UI strings; real store has about 29 languages`],
]
kpis.forEach(([t, v, s], i) => {
  const x = 30 + i * 255
  body += `<g><rect x="${x}" y="${y}" width="243" height="92" rx="6" fill="#141b24" stroke="#243142"/><text x="${x + 14}" y="${y + 22}" class="leg">${esc(t)}</text><text x="${x + 14}" y="${y + 58}" class="kpi">${esc(v)}</text><text x="${x + 14}" y="${y + 78}" class="mini">${esc(s.length > 46 ? s.slice(0, 45) + '…' : s)}</text></g>`
})
y += 110

section('Feature coverage', 'One cell per observed behavior. Hover a cell for its name. Green replicated, olive partial, grey not yet.')
body += `<text x="30" y="${y + 14}" class="h3">Client UI: ${ct.d}/${ct.n} (${((ct.d / ct.n) * 100).toFixed(1)}%)</text><text x="1020" y="${y + 14}" class="h3">Backend and protection: ${bt.d}/${bt.n} (${((bt.d / bt.n) * 100).toFixed(1)}%)</text>`
body += treemap(client, { x: 30, y: y + 24, w: 970, h: 380 }) + treemap(backend, { x: 1020, y: y + 24, w: 550, h: 380 })
y += 430

section('Fidelity against the real store', 'Visual = layout, color, type and motion; behavior = interactions and data. 0-100, from REA captures. Grey rows have not been compared yet.')
PAGES.forEach(p => {
  const ry = y
  body += `<text x="30" y="${ry + 14}" class="row">${esc(p.page)}</text><text x="270" y="${ry + 14}" class="mini">${esc(p.route)}</text>`
  if (p.visual !== null && p.behavior !== null) {
    body += bar(430, ry + 3, 230, 7, p.visual, scoreColor(p.visual)) + bar(430, ry + 13, 230, 7, p.behavior, scoreColor(p.behavior))
    body += `<text x="670" y="${ry + 11}" class="mini">visual ${p.visual}</text><text x="670" y="${ry + 21}" class="mini">behavior ${p.behavior}</text>`
  } else body += `<text x="430" y="${ry + 14}" class="mini" fill="#7c828c">${p.method === 'no-web-equivalent' ? 'no web equivalent' : 'not compared yet'}</text>`
  body += `<text x="760" y="${ry + 14}" class="badge">${esc(p.method)}</text><text x="940" y="${ry + 14}" class="mini">${esc(p.notes.length > 104 ? p.notes.slice(0, 103) + '…' : p.notes)}</text>`
  y += 28
})

section('API surface', `${endpoints.length} endpoints across ${areas.length} areas, ${dbTables} database tables, plus one Durable Object per user for WebSocket push. Green = exercised by an e2e check.`)
areas.forEach(a => {
  const list = endpoints.filter(e => e.area === a)
  const t = list.filter(e => e.tested).length
  body += `<text x="30" y="${y + 14}" class="row">${esc(a)}</text>${bar(300, y + 3, 420, 12, (t / list.length) * 100, '#3b9d3b', '#2b3039')}<text x="732" y="${y + 14}" class="mini">${t}/${list.length} tested · ${list.filter(e => !e.auth).length} public · ${list.filter(e => e.write).length} writes (rate limited)</text>`
  y += 26
})
const untested = endpoints.filter(e => !e.tested)
body += `<text x="30" y="${y + 18}" class="mini">Not yet covered by a check: ${esc(untested.slice(0, 9).map(e => `${e.method} ${e.path}`).join(', '))}${untested.length > 9 ? ` and ${untested.length - 9} more` : ''}</text>`
y += 30

section('Translation', `${langRows.length} languages × ${english.size} strings, all complete. But only ${((textTranslated / (textTranslated + textLiterals)) * 100).toFixed(0)}% of on-screen text goes through the translator (${textTranslated} call sites vs about ${textLiterals} hard-coded labels).`)
textCoverage.slice(0, 14).forEach(r => {
  body += `<text x="30" y="${y + 13}" class="row">${esc(r.file)}</text>${bar(300, y + 3, 420, 11, r.pct, scoreColor(r.pct), '#2b3039')}<text x="732" y="${y + 13}" class="mini">${r.translated} translated · ${r.literals} hard-coded</text>`
  y += 22
})
body += `<text x="30" y="${y + 14}" class="mini">Languages: ${esc(langRows.map(l => l.name).join(', '))}. Strings missing for the other ~17 languages the real store offers.</text>`
y += 28

section('Largest gaps', 'Missing or partial behaviors, in the order they matter most.')
const gaps = [...client.flatMap(g => g.leaves.filter(l => l.s === 'm').map(l => ({ g: g.name, ...l }))), ...backend.flatMap(g => g.leaves.filter(l => l.s === 'm').map(l => ({ g: g.name, ...l })))]
gaps.slice(0, 14).forEach((x, i) => { body += `<text x="${30 + (i % 2) * 780}" y="${y + 14 + Math.floor(i / 2) * 22}" class="row">• ${esc(x.name)} <tspan class="mini">(${esc(x.g)})</tspan></text>` })
y += Math.ceil(Math.min(gaps.length, 14) / 2) * 22 + 12

section('Evidence log', 'What was actually captured from the real store, so every score above can be traced.')
EVIDENCE.forEach(e => { body += `<text x="30" y="${y + 14}" class="mini">${esc(e.when)}</text><text x="120" y="${y + 14}" class="row">${esc(e.tool)}</text><text x="470" y="${y + 14}" class="mini">${esc(e.subject)} → ${esc(e.result.length > 88 ? e.result.slice(0, 87) + '…' : e.result)}</text>`; y += 22 })
y += 34
body += `<g transform="translate(30 ${y})"><rect width="12" height="12" fill="${COLOR.d}"/><text x="18" y="11" class="leg">replicated</text><rect x="110" width="12" height="12" fill="${COLOR.p}"/><text x="128" y="11" class="leg">partial</text><rect x="200" width="12" height="12" fill="${COLOR.m}"/><text x="218" y="11" class="leg">not yet</text><text x="300" y="11" class="leg">${routes.length} client routes · ${Object.entries(sizes).map(([k, v]) => `${v.toLocaleString()} lines ${k}`).join(' · ')}</text></g>`
const H = y + 40
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">
<style>.h1{fill:#fff;font-size:28px;font-weight:700}.h2{fill:#fff;font-size:20px;font-weight:700}.h3{fill:#cfe7cf;font-size:15px;font-weight:600}.lbl{fill:#fff;font-size:13px;font-weight:700;paint-order:stroke;stroke:#0b1a0e;stroke-width:3px}.sub{fill:#dff5df;font-size:11px;paint-order:stroke;stroke:#0b1a0e;stroke-width:3px}.leg{fill:#9aa4b2;font-size:12px}.mini{fill:#9aa4b2;font-size:11px}.row{fill:#e6edf3;font-size:13px}.kpi{fill:#fff;font-size:30px;font-weight:700}.badge{fill:#6fa8dc;font-size:11px}</style>
<rect width="${W}" height="${H}" fill="#0d1117"/>
${body}
</svg>
`
writeFileSync(new URL('docs/coverage.svg', root), svg)

// ---------------------------------------------------------------- markdown and json
const md: string[] = [`# reSteam replication coverage`, '', `Generated ${today} from commit \`${commit}\`. Run \`npm run coverage\` to refresh.`, '',
  '![coverage poster](coverage.svg)', '', '## Summary', '', '| Measure | Value |', '| --- | --- |',
  `| Client behaviors replicated | ${ct.d} of ${ct.n} (${ct.p} partial, ${ct.m} not yet) |`, `| Backend behaviors replicated | ${bt.d} of ${bt.n} (${bt.p} partial, ${bt.m} not yet) |`,
  `| Visual fidelity (average of compared pages) | ${visualAvg.toFixed(0)} / 100 over ${compared.length} pages |`, `| Behavior fidelity | ${behaviorAvg.toFixed(0)} / 100 |`,
  `| API endpoints | ${endpoints.length} (${tested} exercised by e2e checks) |`, `| Automated checks | ${checks} |`, `| Client routes | ${routes.length} |`, `| Database tables | ${dbTables} |`, `| Languages | ${langRows.length} (${english.size} strings) |`, '',
  '## Fidelity by page', '', '| Page | Route | Method | Visual | Behavior | Verified | Notes |', '| --- | --- | --- | --- | --- | --- | --- |',
  ...PAGES.map(p => `| ${p.page} | \`${p.route}\` | ${p.method} | ${p.visual ?? '-'} | ${p.behavior ?? '-'} | ${p.verified || '-'} | ${p.notes} |`), '',
  '## API endpoints', '', '| Method | Path | Area | Auth | Writes | Tested |', '| --- | --- | --- | --- | --- | --- |',
  ...endpoints.map(e => `| ${e.method} | \`${e.path}\` | ${e.area} | ${e.auth ? 'yes' : 'public'} | ${e.write ? 'yes' : '-'} | ${e.tested ? 'yes' : '**no**'} |`), '',
  '## Translation', '', '| Language | Strings | Coverage |', '| --- | --- | --- |', ...langRows.map(l => `| ${l.name} | ${l.have}/${l.total} | ${Math.round((l.have / l.total) * 100)}% |`), '',
  '## UI text going through the translator', '', '| File | Translated | Hard-coded | Coverage |', '| --- | --- | --- | --- |', ...textCoverage.map(r => `| ${r.file} | ${r.translated} | ${r.literals} | ${r.pct.toFixed(0)}% |`), '',
  '## Features', '', ...[['Client UI', client], ['Backend and protection', backend]].flatMap(([t, g]) => [`### ${t as string}`, '', ...(g as typeof client).flatMap(x => [`**${x.name}** (${x.leaves.filter(l => l.s === 'd').length}/${x.leaves.length})`, '', ...x.leaves.map(l => `- ${l.s === 'd' ? '[x]' : l.s === 'p' ? '[~]' : '[ ]'} ${l.name}`), ''])]),
  '## Evidence log', '', '| When | Tool | Subject | Result |', '| --- | --- | --- | --- |', ...EVIDENCE.map(e => `| ${e.when} | ${e.tool} | ${e.subject} | ${e.result} |`), '']
writeFileSync(new URL('docs/coverage.md', root), md.join('\n'))
writeFileSync(new URL('docs/coverage.json', root), JSON.stringify({ generated: today, commit, summary: { client: ct, backend: bt, visualAvg, behaviorAvg, endpoints: endpoints.length, tested, checks, routes: routes.length, dbTables }, pages: PAGES, endpoints, languages: langRows, textCoverage, evidence: EVIDENCE }, null, 2))
console.log(`client ${ct.d}/${ct.n}, backend ${bt.d}/${bt.n}, ${endpoints.length} endpoints (${tested} tested), ${checks} checks, ${langRows.length} languages -> docs/coverage.{svg,md,json}`)
