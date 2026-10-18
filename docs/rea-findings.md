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
