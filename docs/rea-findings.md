# What REA found

Notes from studying the public web storefront with [REA](https://github.com/morluto/rea). Only observations of public pages; no credentials were entered and no images or code were copied into this repository.

## Tools used

| Tool | Used for |
| --- | --- |
| `capture_browser_scenario` | Loading pages in a controlled browser, screenshots at the real window size, network events |
| `list_browser_targets`, `inspect_web_page` | Attaching to a live Chrome (CDP) to read the DOM structure, accessibility tree, scripts and resources |
| `analyze_web_bundle` | Static analysis of the page's JavaScript for routes and endpoint literals |
| `capture_web_screenshot` | Pixel-level reference captures |
| `export_evidence_bundle` | Writing retained evidence to disk when a response exceeded the transport budget |

## Findings

**Login page** (`/login`)
- Structure: global header, store sub-menu, a blurred collage background, a "Sign in" heading and one centered card.
- Form: account name, password, "Remember me" (checked by default), a primary "Sign in" button, "Help, I can't sign in", and a "Create an account" link.
- Beside the form: a QR code panel ("sign in with QR") for approving a login from an already signed-in mobile device.
- On load it starts a QR auth session and attempts a token refresh. That means sign-in is a two-device handshake, not just a form.

**Store pages**
- The page is mostly images (71 of 139 requests on the home page), scripts (41) and stylesheets (14).
- Only three data calls: sale data, a per-user call (wishlist, owned, ignored, followed lists) and a batch "get items" lookup. Personal lists live on the server with the account.
- Static bundle analysis (13 scripts, ~625 KB) found no route or endpoint literals: the page builds its requests dynamically, so runtime capture is the reliable source.

## How this shaped reSteam

- Accounts use cookie sessions, with a QR approval flow modeled on the two-device handshake above.
- `ignored` and `followed` lists, like wishlist and library, are stored server-side with the account.
- A single batched stats lookup feeds the store instead of per-card requests.

## Store home load sequence (REA network capture, signed out)

138 requests in 6 s. The non-asset calls, in order:

1. `GET /` is server-rendered HTML for the shell and the first shelves.
2. `GET /dynamicstore/saledata/` returns sale/event metadata for the banners.
3. `GET /stats/monthlytopreleaseimages` supplies images for the "new releases" shelf.
4. `GET /dynamicstore/userdata/` returns the signed-in user's wishlist, owned, ignored and followed ids (empty when signed out). reSteam folds this into `GET /api/me`.
5. A batched `IStoreBrowseService/GetItems` call fetches full item data for every capsule at once. reSteam ships the catalog with the bundle and overlays live stats from `GET /api/stats`.

The takeaway: render from a catalog fetch, then overlay per-user state, rather than one request per capsule.

## Motion and loading (REA scenario + the store's own CSS)

Read from the real store's stylesheets (asset URLs taken from the REA network capture):

- **Loading screen:** a 62 px wrapper with three 12 px bars, `#67c1f5`, animated by `loading_throbber_bar` (scaleY 0.6 → 1.0 at 30% → 0.6 at 55%, 1 s ease-in-out, infinite), delayed 0 / 0.16 s / 0.32 s, with 22 px `#60acde` text underneath. reSteam's `Loading` component copies this exactly.
- **Tab content while reloading:** `opacity .5` with `transition: opacity .25s`.
- **Carousel:** slides cross-fade with `opacity 400ms`; arrows sit at `opacity .7` and ease to 1 in `.2s`; pager dots transition their color in `.2s`.
- **Hover lifts:** the gift-card link moves `translateY(-2px)` with a `0 6px 24px 4px rgba(13,170,243,.35)` glow; split banners lift 3 px; capsule images use `transform .2s ease-in-out`.
- **Menus:** nav tabs flip to a `#67c1f5 → #417a9b` gradient on hover; popup menu items gain a 2 px white bottom border over `.15s`.
- **Capsule hover previews:** screenshots cross-fade on a 4 s loop (`screenshot_hover_fadein`).

REA's response-body capture is capped at 64 KiB per body, so large stylesheets and scripts were read from the asset URLs the capture reported.
