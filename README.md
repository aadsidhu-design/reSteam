# reSteam

A from-scratch, fan-made recreation of the look and behavior of a popular desktop game-store client: store, library, downloads, friends and chat, community, settings. It is a **UI study**, not a product.

> Not affiliated with, endorsed by, or derived from Valve. Steam is a trademark of Valve Corporation. reSteam contains no Valve code, artwork, fonts or logos. All game art is generated procedurally in the browser, and every game, studio, friend and review in the catalog is fictional.

## Coverage

![Replication coverage treemap](docs/coverage.svg)

Each cell is one observed behavior of the real client. Green is replicated, olive is partial, gray is not yet. The map is generated from [`scripts/features.ts`](scripts/features.ts) with `npm run coverage`, so it moves when the code does.

## How it was built

The real client was studied with [REA](https://github.com/morluto/rea) and by driving the running app on a Mac:

- REA read the client's bundled UI (a React + MobX + webpack app inside Chromium Embedded Framework), its dependency list, string tables and CSS.
- Screenshots of the live client, taken one window at a time, supplied the layout, spacing and colors that were then measured pixel by pixel.
- The rebuilt app was screenshotted at the real window's size and density and compared against those references, screen by screen.

No reference screenshots are included in this repository, because they can contain personal data.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TypeScript, React Router, MobX, plain CSS |
| Art | Procedural SVG generated per game (`src/art.tsx`) |
| API | Cloudflare Worker (`worker/index.ts`), no framework |
| Data | Cloudflare D1 (SQLite), schema and seed in `migrations/` |
| Abuse protection | Workers rate-limit bindings, body caps, same-origin check, CSP and other headers |

The game catalog lives once, in `src/data.ts`; `npm run db:seed` turns it into an upserting migration so the browser and the database cannot drift apart.

## Run it locally

```bash
npm install
cp wrangler.example.jsonc wrangler.jsonc   # local dev needs no real ids
npm run db:local                           # create and migrate the local D1 database
npm run build
npm run api                                # Worker + built UI at http://localhost:8787
```

For UI work with hot reload, run `npm run api` in one terminal and `npm run dev` in another (Vite proxies `/api`).

`scripts/demo-seed.sh` fills a **local** demo account so screenshots show a populated library.

## Deploy to your own Cloudflare account

```bash
npx wrangler login
npx wrangler d1 create resteam              # paste the database_id into wrangler.jsonc
npx wrangler d1 migrations apply resteam --remote
npm run deploy
```

`wrangler.jsonc` is git-ignored on purpose: it holds your account and database ids.

## Security notes

- There are no secrets in this repository. Configuration ids live in the git-ignored `wrangler.jsonc`.
- There is no real sign-in. Each browser gets a random UUID session that acts as a bearer token, so treat it as a demo. Do not put real data in it.
- The wallet is play money, and a few public promo codes exist for the demo (see `worker/index.ts`).
- Rate limits are per Cloudflare location and approximate; they are a backstop against abuse, not an exact quota.

## Scripts

`dev`, `build`, `api`, `db:local`, `db:seed`, `coverage`, `deploy`.

## License

MIT for the code in this repository. See the notice above about third-party trademarks.
