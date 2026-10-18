# reSteam

A from-scratch, fan-made recreation of the look and behavior of a popular PC game **web store**: storefront, library, downloads, accounts, friends with real-time chat, community hubs with reviews, discussions and guides, settings. It is a **UI study**, not a product.

> Not affiliated with, endorsed by, or derived from Valve. Steam is a trademark of Valve Corporation. reSteam contains no Valve code, artwork, fonts or logos. All game art is generated procedurally in the browser, and every game and studio in the catalog is fictional. Accounts, friends, messages, reviews and posts are real data created by people using the site.

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
| API | Cloudflare Worker (`worker/index.ts`), no framework; one SQLite Durable Object (`UserHub`) per user pushes chat, typing and notification events over WebSocket |
| Data | Cloudflare D1 (SQLite), schema and seed in `migrations/` |
| Abuse protection | Workers rate-limit bindings, body caps, same-origin check, CSP and other headers |

The game catalog lives once, in `src/data.ts`; `npm run db:seed` turns it into an upserting migration so the browser and the database cannot drift apart.

## Uploading games

Anyone with an account can open **Upload a game** (`/developer`), create a game, upload a cover, a **web build** and/or a **downloadable build**, and publish it to the store.

- **Web builds** are a `.zip` with `index.html` at the top (HTML5 / JS / WebAssembly). They run inside reSteam in a sandboxed frame (`allow-scripts` only: no cookies, no access to the site or its API, no network except its own files). Access goes through a short-lived play token, so only owners can load them.
- **Downloadable builds** are any file up to 50 MB. Owners download it from their library with real progress and speed; the file is saved to disk.
- Files live in an R2 bucket (`FILES` binding); D1 holds metadata. Limits are small on purpose (10 games per account, 5 creations per hour, 15 MB zips, 40 MB unpacked, 300 files, covers must be real PNG/JPEG/WebP).

## Run it locally

```bash
npm install
cp wrangler.example.jsonc wrangler.jsonc   # local dev needs no real ids
npm run db:local                           # create and migrate the local D1 database (local R2 is simulated)
npm run build
npm run api                                # Worker + built UI at http://localhost:8787
```

For UI work with hot reload, run `npm run api` in one terminal and `npm run dev` in another (Vite proxies `/api`).

`npm run test:e2e` (with the API running) exercises accounts, friends, chat, community and rate limits end to end; it takes a couple of minutes because it waits out the write limiter.

## Deploy to your own Cloudflare account

```bash
npx wrangler login
npx wrangler d1 create resteam              # paste the database_id into wrangler.jsonc
npx wrangler r2 bucket create resteam-files  # uploaded games live here
npx wrangler d1 migrations apply resteam --remote   # migration 0009 deletes all old anonymous-session data
npm run deploy
```

`wrangler.jsonc` is git-ignored on purpose: it holds your account and database ids.

## Security notes

- There are no secrets in this repository. Configuration ids live in the git-ignored `wrangler.jsonc`.
- Accounts use a username and password. Passwords are hashed with salted PBKDF2-SHA256; only a hash of each session token is stored, and the cookie is `HttpOnly; SameSite=Strict`.
- Each account gets a one-time recovery key (shown once, rotated on use). QR sign-in lets a signed-in device approve another browser.
- Non-GET requests need `x-requested-with` and a same-origin `Origin`; login, registration and username lookups are throttled per IP and per name, and login errors are generic.
- The wallet is play money, and a few public promo codes exist for the demo (see `worker/shop.ts`).
- Rate limits are per Cloudflare location and approximate; they are a backstop against abuse, not an exact quota.

## Scripts

`dev`, `build`, `api`, `db:local`, `db:seed`, `test:e2e`, `typecheck`, `coverage`, `deploy`.

## License

MIT for the code in this repository. See the notice above about third-party trademarks.
