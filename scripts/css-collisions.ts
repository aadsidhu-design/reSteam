// Fails when a plain `.class` rule is defined in more than one stylesheet. All CSS is bundled globally, so
// a name reused in two files silently overrides the first (this once broke the search results layout).
import { readdirSync, readFileSync } from 'node:fs'

const dir = new URL('../src/', import.meta.url)
const seen = new Map<string, Set<string>>()
for (const f of readdirSync(dir).filter(n => n.endsWith('.css'))) {
  const css = readFileSync(new URL(f, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)) {
    for (const sel of m[1].split(',')) {
      const c = sel.trim().match(/^\.([A-Za-z0-9_-]+)$/)
      if (c) seen.set(c[1], (seen.get(c[1]) ?? new Set()).add(f))
    }
  }
}
const dups = [...seen].filter(([, files]) => files.size > 1)
for (const [cls, files] of dups) console.error(`.${cls} is defined in: ${[...files].join(', ')}`)
if (dups.length) process.exit(1)
console.log(`css ok: ${seen.size} classes, no cross-file collisions`)
