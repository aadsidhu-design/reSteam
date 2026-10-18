// Hand-recorded comparisons against the real store. Scores are 0-100 and come from side-by-side REA screenshots
// (and, where noted, a connected signed-in browser). `null` means the page was not compared yet.
export type Method = 'screenshot+css' | 'connected-browser' | 'network-capture' | 'not-compared' | 'no-web-equivalent'
export interface PageFidelity {
  page: string; route: string; real: string; method: Method
  visual: number | null; behavior: number | null; verified: string; notes: string
}

export const PAGES: PageFidelity[] = [
  { page: 'Global header and nav', route: '(all)', real: 'store.steampowered.com', method: 'connected-browser', visual: 90, behavior: 82, verified: '2026-10-18', notes: '104 px bar, nav positions, active underline and top-row links measured. Install button replaced by Upload a game.' },
  { page: 'Store home', route: '/store', real: '/', method: 'screenshot+css', visual: 80, behavior: 76, verified: '2026-10-18', notes: 'Hero, 840+360 carousel with peeking slides, section order and spacing match. Art is procedural; fewer shelves.' },
  { page: 'Mega menus (6)', route: '(store nav)', real: '/ (open panels)', method: 'connected-browser', visual: 72, behavior: 78, verified: '2026-10-18', notes: 'Panel structure, headings, tiles, pills, expand control and animation match. Contents are reSteam’s own; Hardware has no products.' },
  { page: 'Game page', route: '/store/:id', real: '/app/:id', method: 'screenshot+css', visual: 72, behavior: 72, verified: '2026-10-18', notes: 'Backdrop, banner, breadcrumb, buy box, rails match. No trailers, DLC or system requirements.' },
  { page: 'Search results', route: '/store/browse', real: '/search/', method: 'screenshot+css', visual: 88, behavior: 82, verified: '2026-10-18', notes: 'Rows, filter panels, chips and sort match; filters are fewer than the real ~40.' },
  { page: 'Cart', route: '/cart', real: '/cart/', method: 'connected-browser', visual: 85, behavior: 78, verified: '2026-10-18', notes: 'Compared with an empty cart only; payment step is play money.' },
  { page: 'Wishlist', route: '/wishlist', real: '/wishlist/', method: 'connected-browser', visual: 76, behavior: 68, verified: '2026-10-18', notes: 'Header and empty state matched; populated rows not compared.' },
  { page: 'Community home', route: '/community', real: 'steamcommunity.com', method: 'screenshot+css', visual: 70, behavior: 62, verified: '2026-10-18', notes: '940 px column, panels and tabs match; no workshop, screenshots or broadcasts.' },
  { page: 'Discovery queue', route: '/explore', real: '/explore/', method: 'screenshot+css', visual: 48, behavior: 60, verified: '2026-10-18', notes: 'Only the home banner was compared; the queue page is modelled on its behavior.' },
  { page: 'Login', route: '/login', real: 'login page', method: 'network-capture', visual: 66, behavior: 86, verified: '2026-10-17', notes: 'Form, QR sign-in handshake and recovery flow studied; visual treatment is approximate.' },
  { page: 'Footer', route: '(all)', real: 'wishlist page footer', method: 'connected-browser', visual: 74, behavior: 60, verified: '2026-10-18', notes: 'Four-column layout matched; legal pages do not exist.' },
  { page: 'Loading and motion', route: '(all)', real: 'stylesheets', method: 'screenshot+css', visual: 94, behavior: 88, verified: '2026-10-18', notes: 'Throbber, carousel fades, hover lifts and menu timings copied from the real CSS values.' },
  { page: 'Language menu', route: '(header)', real: 'language pulldown', method: 'connected-browser', visual: 70, behavior: 55, verified: '2026-10-18', notes: '12 of about 29 languages, chrome strings only; real store translates every page.' },
  { page: 'Community hub and posts', route: '/community?hub=', real: 'steamcommunity.com/app/:id', method: 'connected-browser', visual: 72, behavior: 62, verified: '2026-10-18', notes: 'Title row, tab row, stats line, banner and popular-content note now follow the real order. No screenshots, artwork, videos or workshop; News and Follow added.' },
  { page: 'Profile', route: '/profile', real: 'steamcommunity.com/id/:name', method: 'connected-browser', visual: 70, behavior: 66, verified: '2026-10-18', notes: 'Avatar frame, Level badge, Recent Activity panel with achievement bars and the status sidebar match. No badges, inventory or showcases.' },
  { page: 'Settings / account', route: '/settings/*', real: 'store.steampowered.com/account', method: 'connected-browser', visual: 74, behavior: 56, verified: '2026-10-18', notes: 'Breadcrumb, large title, side nav and blue section bars match the account page. No purchase history, family or payment methods; most panes are reSteam settings.' },
  { page: 'Library', route: '/library', real: '-', method: 'no-web-equivalent', visual: null, behavior: null, verified: '', notes: 'The real library lives in the desktop client; modelled on the earlier client study.' },
  { page: 'Downloads', route: '/downloads', real: '-', method: 'no-web-equivalent', visual: null, behavior: null, verified: '', notes: 'Client-only feature, here backed by real file downloads for uploaded builds.' },
]

export interface Evidence { when: string; tool: string; subject: string; result: string }
export const EVIDENCE: Evidence[] = [
  { when: '2026-10-17', tool: 'capture_browser_scenario (network)', subject: 'store home, signed out', result: '138 requests; saledata, userdata, GetItems batch API identified' },
  { when: '2026-10-17', tool: 'real stylesheets via REA asset URLs', subject: '14 store stylesheets', result: 'loading throbber, carousel, hover and menu timings extracted' },
  { when: '2026-10-18', tool: 'capture_browser_scenario (screenshots)', subject: 'home, game, search, community at 1400 px', result: 'layout widths, heights and colors measured against ours' },
  { when: '2026-10-18', tool: 'connected browser (CDP, signed in)', subject: 'six store menus', result: 'panel structure, headings, links and animation captured' },
  { when: '2026-10-18', tool: 'connected browser (CDP, signed in)', subject: 'cart, wishlist, language pulldown', result: 'layouts and empty states captured; 29-language list read' },
  { when: '2026-10-18', tool: 'font width fit', subject: '17 open fonts vs real nav text', result: 'Albert Sans matched real widths at native size (scale 0.99 to 1.00)' },
  { when: 'earlier', tool: 'desktop client study (REA)', subject: 'library, friends, downloads, settings', result: 'client behaviors recorded in docs/rea-findings.md' },
]
