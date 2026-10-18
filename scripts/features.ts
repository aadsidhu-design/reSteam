// One entry per observed (or documented) client behavior. Suffix: :d done, :p partial, :m missing.
// Source of truth for docs/coverage.svg. Edit statuses here as features land, then `npm run coverage`.
type Group = Record<string, string[]>

export const CLIENT: Group = {
  'Window chrome': [
    'Back button:d', 'Forward button:d', 'STORE tab:d', 'LIBRARY tab:d', 'COMMUNITY tab:d', 'Profile tab:d', 'Active tab underline:d',
    'URL row with refresh and lock:d', 'News megaphone button:d', 'News popover:d', 'Notification bell:d', 'Unread count badge:d', 'Notifications popover:d',
    'Mark all read:d', 'Account menu:d', 'Sign out confirmation:d', 'Balance chip:d', 'Window control dots:d', 'Bottom bar:d', 'Add a Game menu:d',
    'Add non-store game:d', 'Activate a product:d', 'Manage Downloads button:d', 'Mini download progress:d', 'Friends & Chat button:d',
    'Toast notifications:d', 'macOS menu bar:m', 'Window resize handle:m', 'Keyboard shortcuts:m', 'Real window dragging:m',
  ],
  'Library': [
    'Home button:d', 'Grid view toggle:d', 'Category dropdown:d', 'Platform filter:p', 'Recent sort toggle:d', 'Ready-to-play toggle:d', 'Library search:d',
    'Filter popover:p', 'Favorites section:d', 'Uncategorized section:d', 'Collapsible sections:d', 'Game icons in list:p', 'Running indicator:d',
    'Right-click menu:d', 'Custom collections:m', 'Drag to reorder:m', "What's New shelf:d", 'Shelf options menu:d', 'Add shelf:d',
    'Recent Games shelf:d', 'Time-group labels:d', 'Wide capsule + Time Played:d', 'Shelf scroll arrows:d', 'Download badge on capsule:d',
    'Favorites shelf:d', 'Play Next shelf:d', 'Installed shelf:d', 'Friends Activity shelf:m', 'Grid size setting:d', 'Poster grid view:d',
  ],
  'Game page': [
    'Hero art:p', 'Install split button:d', 'Install options menu:d', 'Play button:d', 'Stop button:d', 'Pause/Resume:d', 'Space required:d',
    'Last played:d', 'Play time:d', 'Achievements stat:d', 'Gear menu:d', 'Info dialog:d', 'Favorite heart:d', 'Store Page tab:d', 'Community Hub tab:d',
    'Discussions tab:d', 'Guides tab:d', 'Points Shop tab:m', 'Support tab:m', 'Activity post box:d', 'Activity feed:p', 'View Latest News:d',
    'Friends who play panel:d', 'Achievements list:m', 'Trading cards:m', 'Workshop / DLC section:m', 'Controller config:m', 'Cloud sync status:m', 'Properties dialog:m',
  ],
  'Downloads': [
    'Network stat:d', 'Peak stat:d', 'Disk usage stat:d', 'Live bandwidth graph:d', 'Active download panel:d', 'Phase labels:d', 'Progress and ETA:d',
    'Up Next queue:d', 'Download next:d', 'Pause and resume:d', 'Remove from queue:d', 'Recently completed:d', 'Settings gear:d', 'Auto-updates label:d',
    'Bandwidth limit:d', 'Pause while playing:d', 'Scheduled updates:m', 'Download region:m',
  ],
  'Store': [
    'Browse menu:d', 'Recommendations menu:d', 'Categories menu:d', 'Hardware menu:p', 'Ways to Play menu:d', 'Special Sections menu:d',
    'Search with suggestions:d', 'Wishlist link:d', 'Sale hero banner:d', 'Featured carousel:d', 'Carousel info panel:d', 'Send a Gift Card:d',
    'Special offers:d', 'Browse by genre:d', 'Top sellers tabs:d', 'Free to play row:d', 'Game page media viewer:p', 'Game page description:d',
    'Review summary:d', 'Popular tags:d', 'Buy box:d', 'Follow / Ignore:p', 'System requirements:d', 'Customer reviews:p', 'More like this:d',
    'Cart page:d', 'Checkout:d', 'Wishlist page:d', 'Free-to-play claim:d', 'Discount badges:d',
  ],
  'Friends & Chat': [
    'Friends window:d', 'Profile header:d', 'Status menu:d', 'Drag hint:p', 'FRIENDS bar:d', 'Friend search:d', 'Add a friend:d', 'Collapsible groups:d',
    'A-Z sort:d', 'Friend rows:d', 'Last online text:d', 'Right-click menu:d', 'View profile dialog:d', 'Chat window:d', 'Typing indicator:d',
    'Group chats list:d', 'Create group chat:d', 'Group chat window:d', 'Pending requests:d', 'Remove friend:d', 'Offline messaging:d', 'Invite to play:p',
    'Voice chat:m', 'Screenshot sharing:m', 'Emoji and stickers:m', 'Nicknames:m', 'Block user:m', 'Friend activity feed:m',
    'Drag to pin friends:m', 'Friends window dragging:d',
  ],
  'Community': [
    'Activity page:d', 'Recently played hubs:d', 'Popular hubs:d', 'Find hubs search:d', 'Find people search:d', 'Content tabs:d', 'Most popular / recent:d',
    'Content cards:p', 'Review cards:p', 'Hub pages:d', 'Discussions:p', 'Guides:p', 'Workshop browse:p', 'News posts:p', 'Market:m', 'Broadcasts:p',
  ],
  'Settings': [
    'Settings window:d', 'Account page:d', 'Add funds:d', 'Privacy settings:p', 'Friend code:d', 'Friends & Chat page:p', 'Notifications page:p',
    'Interface page + UI scale:d', 'Store page:p', 'Library page:d', 'Downloads page:d', 'Storage page:d', 'Cloud page:p', 'In Game page:d',
    'Accessibility page:p', 'Family page:m', 'Security page:p', 'Controller page:m', 'Game Recording page:m', 'Voice page:m',
  ],
  'Profile': [
    'Profile page:d', 'Edit display name:d', 'Avatar:p', 'Level badge:d', 'Stats:d', 'Recent activity:d', 'Showcases:p', 'Badges:m',
  ],
}

export const BACKEND: Group = {
  'Accounts': [
    'Anonymous session ids:d', 'UUID validation:d', 'Per-user wallet:d', 'Display name:d', 'Presence status:d', 'Sign out / reset:d', 'Real sign-in:m', 'Email on account:m', 'Two-factor:m',
  ],
  'Catalog': [
    'Games API:d', 'Tags and publisher:d', 'Reviews and sizes:d', 'Seed from one source:d', 'Upserting migrations:d', 'Search API:m', 'Recommendations:m', 'Developer uploads:m',
  ],
  'Commerce': [
    'Cart add/remove:d', 'Atomic checkout:d', 'Server-side pricing:d', 'Wishlist:d', 'Add funds (capped):d', 'Free claim:d', 'Promo codes:d', 'Gift cards:d',
    'Refunds:m', 'Real payments:m', 'Regional pricing:m',
  ],
  'Library': [
    'Ownership:d', 'Install state:d', 'Favorites:d', 'Playtime logging:d', 'Last played:d', 'Cloud saves:m', 'Family sharing:m', 'Achievement unlocks:m',
  ],
  'Social': [
    'Friends API:d', 'Add friend (pending):d', 'Auto-accept delay:d', 'Remove friend:d', 'Private to owner:d', 'Chat history:d', 'Bot replies:d', 'Thread cap:d',
    'Real-time chat:m', 'Real other users:m', 'Group chats server-side:m', 'Blocking:m',
  ],
  'Protection': [
    'Per-IP rate limit:d', 'Per-session write limit:d', 'New-user limit:d', 'Body size cap:d', 'Origin check:d', 'Security headers:d', 'CSP:d', 'Bound SQL params:d',
    'Generic 500s:d', 'Dependency audit:d', 'Exact (global) limits:p', 'Abuse monitoring:m',
  ],
}
