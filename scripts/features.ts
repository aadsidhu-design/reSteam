// One entry per observed (or documented) client behavior. Suffix: :d done, :p partial, :m missing.
// Source of truth for docs/coverage.svg. Edit statuses here as features land, then `npm run coverage`.
type Group = Record<string, string[]>

export const CLIENT: Group = {
  'Window chrome': [
    'Global header:d', 'Footer:d', 'About page:d', 'Login / join links:d', 'STORE tab:d', 'LIBRARY tab:d', 'COMMUNITY tab:d', 'Profile tab:d', 'Active tab underline:d',
    'Notification bell:d', 'Unread count badge:d', 'Notifications popover:d',
    'Mark all read:d', 'Account menu:d', 'Balance chip:d', 'Add a Game menu:d',
    'Add non-store game:d', 'Activate a product:d', 'Manage Downloads button:d', 'Mini download progress:d', 'Floating Friends & Chat bar:d',
    'Toast notifications:d', 'Loading throbber:d', 'Carousel crossfade:d', 'Hover motion:d', 'Keyboard shortcuts:m',
  ],
  'Library': [
    'Home button:d', 'Grid view toggle:d', 'Category dropdown:d', 'Platform filter:p', 'Recent sort toggle:d', 'Ready-to-play toggle:d', 'Library search:d',
    'Filter popover:p', 'Favorites section:d', 'Uncategorized section:d', 'Collapsible sections:d', 'Game icons in list:p', 'Running indicator:d',
    'Right-click menu:d', 'Custom collections:d', 'Drag to reorder:m', "What's New shelf:d", 'Shelf options menu:d', 'Add shelf:d',
    'Recent Games shelf:d', 'Time-group labels:d', 'Wide capsule + Time Played:d', 'Shelf scroll arrows:d', 'Download badge on capsule:d',
    'Favorites shelf:d', 'Play Next shelf:d', 'Installed shelf:d', 'Friends Activity shelf:d', 'Grid size setting:d', 'Poster grid view:d',
    'Rename and delete collections:d', 'Add to collection menu:d',
  ],
  'Game page': [
    'Hero art:p', 'Install split button:d', 'Install options menu:d', 'Play button:d', 'Stop button:d', 'Pause/Resume:d', 'Space required:d',
    'Last played:d', 'Play time:d', 'Achievements stat:d', 'Gear menu:d', 'Info dialog:d', 'Favorite heart:d', 'Store Page tab:d', 'Community Hub tab:d',
    'Discussions tab:d', 'Guides tab:d', 'Activity post box:d', 'Activity feed:d', 'View Latest News:d',
    'Friends who play panel:d', 'Achievements list:m', 'Trading cards:m', 'Controller config:m', 'Cloud sync status:m', 'Properties dialog:m',
  ],
  'Downloads': [
    'Network stat:d', 'Peak stat:d', 'Disk usage stat:d', 'Live bandwidth graph:d', 'Active download panel:d', 'Phase labels:d', 'Progress and ETA:d',
    'Up Next queue:d', 'Download next:d', 'Pause and resume:d', 'Remove from queue:d', 'Recently completed:d', 'Settings gear:d', 'Auto-updates label:d',
    'Bandwidth limit:d', 'Pause while playing:d', 'Scheduled updates:m', 'Download region:m',
  ],
  'Store': [
    'Browse menu:d', 'Recommendations menu:d', 'Categories menu:d', 'Hardware menu:d', 'Ways to Play menu:d', 'Special Sections menu:d',
    'Search with suggestions:d', 'Wishlist link:d', 'Sale hero banner:d', 'Featured carousel:d', 'Carousel info panel:d', 'Send a Gift Card:d',
    'Special offers:d', 'Browse by genre:d', 'Top sellers tabs:d', 'Free to play row:d', 'Game page media viewer:p', 'Game page description:d',
    'Review summary:d', 'Popular tags:d', 'Buy box:d', 'Follow / Ignore:d', 'Customer reviews:d', 'Write a review:d', 'Helpful votes:d', 'More like this:d',
    'Discovery Queue:d', 'Charts and stats:d', 'Hover screenshot previews:d', 'Cart page:d', 'Checkout:d', 'Wishlist page:d', 'Free-to-play claim:d', 'Discount badges:d',
    'Search results rows:d', 'Narrow-by filter panels:d', 'Sort options:d', 'Active filter chips:d', 'Excluded titles notice:d', 'Ignore hides games:d', 'Follow list:d', 'Payment step:d', 'Cart recommendations:d', 'Discovery queue banner:d', 'Promo banner:p', 'Featured tag grids:d', 'Top new releases:d', 'Popular tabs with preview:d', 'DLC list:p', 'Handheld compatibility box:p', 'Right rail details:d', 'Age rating box:p', 'Platform icons:p',
  ],
  'Friends & Chat': [
    'Friends window:d', 'Profile header:d', 'Status menu:d', 'Drag hint:d', 'FRIENDS bar:d', 'Friend search:d', 'Add a friend:d', 'Collapsible groups:d',
    'A-Z sort:d', 'Friend rows:d', 'Last online text:d', 'Right-click menu:d', 'Profile pages for others:d', 'Chat window:d', 'Typing indicator:d',
    'Group chats list:d', 'Create group chat:d', 'Group chat window:d', 'Pending requests:d', 'Remove friend:d', 'Offline messaging:d', 'Unread badges:d', 'Accept / ignore requests:d',
    'Voice chat:m', 'Screenshot sharing:m', 'Emoji and stickers:m', 'Nicknames:m', 'Block user:d', 'Friend activity feed:d',
    'Drag to pin friends:d', 
    'Favorites strip:d', 'Add to Favorites menu:d',
  ],
  'Community': [
    'Activity page:d', 'Recently played hubs:d', 'Popular hubs:d', 'Find hubs search:d', 'Find people search:d', 'Content tabs:d', 'Most popular / recent:d',
    'Content cards:d', 'Review cards:d', 'Hub pages:d', 'Discussions:d', 'Guides:d', 'Market:m',
    'Hub header and stats:d', 'Hub store banner:d', 'Guide cards:d', 'Post replies and votes:d', 'Real posts and users:d', 'Upload your own game:d', 'Sale pricing:d', 'Game news and follower alerts:d', 'Developer achievements:d', 'Wishlist sale alerts:d', 'UI translation (11 languages):d', 'Language menu:d', 'Real file downloads:d',
  ],
  'Settings': [
    'Settings window:d', 'Account page:d', 'Add funds:d', 'Privacy settings:d', 'Change password:d', 'Delete account:d', 'Friends & Chat page:d', 'Notifications page:d',
    'Interface page + UI scale:d', 'Store page:d', 'Library page:d', 'Downloads page:d', 'Storage page:d', 'In Game page:d',
    'Accessibility page:d', 'Security page:d', 'Family page:m', 'Controller page:m', 'Voice page:m',
  ],
  'Profile': [
    'Profile page:d', 'Public profiles:d', 'Edit display name:d', 'Avatar:p', 'Level badge:d', 'Stats:d', 'Recent activity:d', 'Showcases:p', 'Badges:m',
  ],
}

export const BACKEND: Group = {
  'Accounts': [
    'Username + password:d', 'PBKDF2 hashing:d', 'Cookie sessions:d', 'Recovery key:d', 'QR sign-in:d', 'Login throttling:d', 'Per-user wallet:d', 'Display name:d', 'Presence status:d', 'Delete account:d', 'Email on account:m', 'Two-factor:m',
  ],
  'Catalog': [
    'Games API:d', 'Tags and publisher:d', 'Live review stats:d', 'Seed from one source:d', 'Upserting migrations:d', 'Search API:m', 'Recommendations:m', 'Developer uploads:m',
  ],
  'Commerce': [
    'Cart add/remove:d', 'Atomic checkout:d', 'Server-side pricing:d', 'Wishlist:d', 'Add funds (capped):d', 'Free claim:d', 'Promo codes:d', 'Gift cards:d',
    'Refunds:m', 'Real payments:m', 'Regional pricing:m',
  ],
  'Library': [
    'Ownership:d', 'Install state:d', 'Favorites:d', 'Playtime logging:d', 'Last played:d', 'Cloud saves:m', 'Family sharing:m', 'Achievement unlocks:d',
  ],
  'Social': [
    'Friend requests:d', 'Accept / decline:d', 'Remove friend:d', 'Blocking:d', 'User search:d', 'Profile privacy:d', 'Presence + now playing:d',
    'Direct messages:d', 'Real-time push (WebSocket):d', 'Typing indicator:d', 'Unread counts:d', 'Group chats:d', 'Notifications:d', 'Friend activity feed:d',
  ],
  'Publishing': [
    'Create a game:d', 'Cover upload:d', 'Screenshot gallery:d', 'Browser-playable builds:d', 'Downloadable builds:d', 'Publish / unpublish:d', 'Edit and delete:d', 'Sandboxed play:d', 'Play tokens:d', 'Owner-only downloads:d', 'Upload limits:d', 'Zip-bomb and path checks:d', 'Cleanup on delete:d', 'Developer revenue:m', 'Versioned updates:m', 'Review before publish:m',
  ],
  'Community': [
    'Reviews:d', 'Helpful votes:d', 'Discussions:d', 'Guides:d', 'Replies:d', 'Post votes:d', 'Reports:d', 'Hub stats:d', 'Moderation tools:m',
  ],
  'Protection': [
    'Per-IP rate limit:d', 'Per-user write limit:d', 'New-user limit:d', 'Body size cap:d', 'Origin check:d', 'Security headers:d', 'CSP:d', 'Bound SQL params:d',
    'Generic 500s:d', 'Dependency audit:d', 'Exact (global) limits:p', 'Abuse monitoring:m',
  ],
}
