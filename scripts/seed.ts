// Generates migrations/0007_catalog_data.sql from the catalog in src/data.ts so there is one source of truth.
// The original 0002 seed is left untouched; this file upserts every game, so it is safe to re-run.
import { writeFileSync } from 'node:fs'
import { GAMES } from '../src/data.ts'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const lines = GAMES.map(g =>
  `INSERT INTO games (id, title, dev, genre, price, discount, rating, released, blurb, hue, icon, tags, publisher, reviews, achievements, size_gb, motif) VALUES (${g.id}, ${q(g.title)}, ${q(g.dev)}, ${q(JSON.stringify(g.genre))}, ${g.price}, ${g.discount}, ${g.rating}, ${q(g.released)}, ${q(g.blurb)}, ${g.hue}, ${q(g.title[0])}, ${q(JSON.stringify(g.tags))}, ${q(g.publisher)}, ${g.reviews}, ${g.achievements}, ${g.sizeGb}, ${q(g.motif)})` +
  ` ON CONFLICT(id) DO UPDATE SET title=excluded.title, dev=excluded.dev, genre=excluded.genre, price=excluded.price, discount=excluded.discount, rating=excluded.rating, released=excluded.released, blurb=excluded.blurb, hue=excluded.hue, icon=excluded.icon, tags=excluded.tags, publisher=excluded.publisher, reviews=excluded.reviews, achievements=excluded.achievements, size_gb=excluded.size_gb, motif=excluded.motif;`)
writeFileSync(new URL('../migrations/0007_catalog_data.sql', import.meta.url), lines.join('\n') + '\n')
console.log(`wrote ${GAMES.length} games`)
