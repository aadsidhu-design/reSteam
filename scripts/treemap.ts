// Renders docs/coverage.svg: a coverage treemap in the style of a binary-coverage map.
// Each cell is one observed behavior; green = replicated, olive = partial, gray = not yet.
import { writeFileSync } from 'node:fs'
import { BACKEND, CLIENT } from './features.ts'

type Leaf = { name: string; s: 'd' | 'p' | 'm' }
type Rect = { x: number; y: number; w: number; h: number }
const COLOR = { d: '#3b9d3b', p: '#a3a23a', m: '#7c7e86' }
const EDGE = '#14301a'

const parse = (g: Record<string, string[]>) =>
  Object.entries(g).map(([name, items]) => ({
    name,
    leaves: items.map((i): Leaf => { const k = i.lastIndexOf(':'); return { name: i.slice(0, k), s: i.slice(k + 1) as Leaf['s'] } })
      .sort((a, b) => 'dpm'.indexOf(a.s) - 'dpm'.indexOf(b.s)),
  }))

/** Squarified treemap (Bruls et al.). */
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
    const rowArea = row.reduce((n, k) => n + items[k].v, 0) * scale
    const thick = rowArea / side
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

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function panel(title: string, groups: ReturnType<typeof parse>, ox: number, W: number, H: number, top: number) {
  const all = groups.flatMap(g => g.leaves)
  const done = all.filter(l => l.s === 'd').length, part = all.filter(l => l.s === 'p').length
  const pct = ((done / all.length) * 100).toFixed(2)
  let svg = `<text x="${ox + 4}" y="28" class="title">${esc(title)}: ${pct}% (${done}/${all.length})</text>${part ? `<text x="${ox + 4}" y="41" class="leg">${part} more partially replicated</text>` : ''}`
  const rects = squarify(groups.map(g => ({ v: g.leaves.length })), { x: ox, y: top, w: W, h: H })
  groups.forEach((g, gi) => {
    const r = rects[gi]
    const pad = 1.5
    const cols = Math.max(1, Math.round(Math.sqrt((g.leaves.length * r.w) / r.h)))
    const rows = Math.ceil(g.leaves.length / cols)
    const ch = (r.h - pad * 2) / rows
    svg += `<g><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#0b1a0e" stroke="#0b1a0e" stroke-width="3"/>`
    g.leaves.forEach((l, li) => {
      const row = Math.floor(li / cols), inRow = row === rows - 1 ? g.leaves.length - (rows - 1) * cols : cols
      const cw = (r.w - pad * 2) / inRow
      const cx = r.x + pad + (li - row * cols) * cw, cy = r.y + pad + row * ch
      svg += `<rect x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" fill="${COLOR[l.s]}" stroke="${EDGE}" stroke-width="0.8"><title>${esc(g.name)}: ${esc(l.name)} (${{ d: 'replicated', p: 'partial', m: 'not yet' }[l.s]})</title></rect>`
    })
    const gd = g.leaves.filter(l => l.s === 'd').length
    svg += `<text x="${r.x + 7}" y="${r.y + 18}" class="lbl">${esc(g.name)}</text><text x="${r.x + 7}" y="${r.y + 33}" class="sub">${gd}/${g.leaves.length}</text></g>`
  })
  return svg
}

const W = 1400, H = 760
const client = parse(CLIENT), backend = parse(BACKEND)
const body = panel('Client UI behaviors', client, 8, 880, H - 96, 44) + panel('Backend and protection', backend, 912, 480, H - 96, 44)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">
<style>.title{fill:#fff;font-size:17px;font-weight:600}.lbl{fill:#fff;font-size:13px;font-weight:700;paint-order:stroke;stroke:#0b1a0e;stroke-width:3px}.sub{fill:#dff5df;font-size:11px;paint-order:stroke;stroke:#0b1a0e;stroke-width:3px}.leg{fill:#c9d1d9;font-size:12px}</style>
<rect width="${W}" height="${H}" fill="#0d1117"/>
${body}
<g transform="translate(10 ${H - 24})"><rect width="12" height="12" fill="${COLOR.d}"/><text x="18" y="11" class="leg">replicated</text>
<rect x="110" width="12" height="12" fill="${COLOR.p}"/><text x="128" y="11" class="leg">partial</text>
<rect x="200" width="12" height="12" fill="${COLOR.m}"/><text x="218" y="11" class="leg">not yet</text>
<text x="300" y="11" class="leg">One cell per observed behavior of the real Steam client. Hover a cell for its name.</text></g>
</svg>
`
writeFileSync(new URL('../docs/coverage.svg', import.meta.url), svg)
const count = (g: typeof client) => { const a = g.flatMap(x => x.leaves); return `${a.filter(l => l.s === 'd').length}/${a.length}` }
console.log(`client ${count(client)}, backend ${count(backend)} -> docs/coverage.svg`)
