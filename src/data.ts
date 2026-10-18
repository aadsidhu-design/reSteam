import { observable } from 'mobx'

export type Motif = 'space' | 'mountain' | 'ocean' | 'city' | 'forest' | 'desert' | 'circuit' | 'dungeon' | 'sun'

export interface Game {
  id: number
  title: string
  dev: string
  publisher: string
  genre: string[]
  tags: string[]
  price: number // cents, 0 = free
  discount: number // percent
  rating: number // % positive, filled from live review stats
  reviews: number
  owners: number
  playing: number
  released: string
  blurb: string
  hue: number
  motif: Motif
  achievements: number
  sizeGb: number
  // set for games uploaded by players
  user?: boolean
  owner?: string | null
  hasCover?: boolean
  shots?: number
  version?: number
  playable?: boolean
  build?: { name: string; size: number } | null
  status?: string
}

const g = (
  id: number, title: string, dev: string, publisher: string, genre: string[], tags: string[],
  price: number, discount: number, released: string,
  blurb: string, hue: number, motif: Motif, achievements: number, sizeGb: number,
): Game => ({ id, title, dev, publisher, genre, tags, price, discount, rating: 0, reviews: 0, owners: 0, playing: 0, released, blurb, hue, motif, achievements, sizeGb })

export const GAMES: Game[] = observable([
  g(1, 'Starfall Frontier', 'Nova Forge', 'Nova Forge', ['Strategy', 'Space'], ['Space', '4X', 'Strategy', 'Sci-fi', 'Singleplayer'], 3999, 25, '2025-03-14', 'Build a fleet, chart unknown systems and survive the long dark between stars.', 230, 'space', 54, 21.4),
  g(2, 'Hollow Pines', 'Quiet Owl Games', 'Quiet Owl Games', ['Horror', 'Adventure'], ['Horror', 'Atmospheric', 'Survival Horror', 'First-Person', 'Story Rich'], 1999, 0, '2024-10-31', 'A night shift at a forest ranger station goes very wrong.', 150, 'forest', 32, 8.1),
  g(3, 'Gearheart', 'Brasswork Studio', 'Brasswork Studio', ['Platformer', 'Indie'], ['Platformer', 'Metroidvania', 'Indie', '2D', 'Difficult', 'Steampunk'], 1499, 40, '2023-06-02', 'A tiny clockwork knight climbs a city made of springs and cogs.', 35, 'city', 63, 4.9),
  g(4, 'Ember Tactics', 'Lantern Lab', 'Lantern Lab', ['Strategy', 'RPG'], ['Turn-Based Tactics', 'RPG', 'Fantasy', 'Story Rich', 'Grid-Based Movement'], 2999, 15, '2025-01-20', 'Turn-based tactics with a squad you will absolutely get attached to.', 15, 'dungeon', 41, 12.3),
  g(5, 'Drift Kings', 'Redline Interactive', 'Redline Interactive', ['Racing', 'Sports'], ['Racing', 'Driving', 'Multiplayer', 'Arcade', 'Fast-Paced'], 5999, 50, '2024-05-09', 'Neon touge battles across forty hand-built mountain passes.', 300, 'mountain', 28, 38.0),
  g(6, 'Tidebreakers', 'Saltwind', 'Saltwind', ['Survival', 'Co-op'], ['Survival', 'Co-op', 'Open World Survival Craft', 'Ocean', 'Multiplayer'], 2499, 0, '2025-07-11', 'Raft, craft and brave the storm with up to four friends.', 190, 'ocean', 47, 6.7),
  g(7, 'Pocket Kingdoms', 'Tiny Crown', 'Tiny Crown', ['Simulation', 'Casual'], ['City Builder', 'Casual', 'Cute', 'Relaxing', 'Management'], 999, 20, '2022-11-18', 'A cozy city builder that fits in the corner of your screen.', 95, 'sun', 25, 0.6),
  g(8, 'Neon Syndicate', 'Voltage 9', 'Voltage 9', ['Shooter', 'Action'], ['FPS', 'Cyberpunk', 'Shooter', 'Heist', 'Multiplayer'], 4499, 30, '2025-09-05', 'Cyberpunk heists with a loadout system that rewards creativity.', 320, 'city', 38, 54.2),
  g(9, 'Mossbound', 'Fernlight', 'Fernlight', ['Puzzle', 'Indie'], ['Puzzle', 'Relaxing', 'Atmospheric', 'Indie', 'Singleplayer'], 1299, 0, '2023-03-30', 'Guide a spirit through overgrown ruins one gentle puzzle at a time.', 120, 'forest', 22, 1.8),
  g(10, 'Blade of Aeon', 'Ironvale', 'Ironvale', ['RPG', 'Action'], ['Open World', 'RPG', 'Fantasy', 'Action RPG', 'Story Rich'], 5999, 10, '2024-11-22', 'A sprawling open-world epic spanning three dying empires.', 5, 'mountain', 77, 96.5),
  g(11, 'Orbital Chess', 'Pawn & Planet', 'Pawn & Planet', ['Strategy', 'Puzzle'], ['Free to Play', 'Chess', 'Strategy', 'Multiplayer', 'Board Game'], 0, 0, '2021-08-01', 'Chess, but the board rotates around a spinning space station.', 250, 'space', 18, 0.4),
  g(12, 'Wildcard Rally', 'Party Hat', 'Party Hat', ['Party', 'Co-op'], ['Party Game', 'Local Multiplayer', 'Co-op', 'Funny', 'Casual'], 1799, 35, '2024-12-12', 'Chaotic minigames for 2-8 players. Friendships not guaranteed.', 55, 'sun', 30, 2.2),
  g(13, 'Deep Signal', 'Static Bloom', 'Static Bloom', ['Horror', 'Space'], ['Horror', 'Space', 'Sci-fi', 'Atmospheric', 'Psychological Horror'], 2299, 25, '2025-04-04', 'Alone on a derelict station, you are not the only one listening.', 270, 'space', 36, 9.4),
  g(14, 'Farmstead Legends', 'Barnyard Bros', 'Barnyard Bros', ['Simulation', 'RPG'], ['Farming Sim', 'Life Sim', 'Cute', 'Relaxing', 'Co-op'], 2499, 0, '2023-09-14', 'Inherit a run-down farm and a surprisingly dramatic village.', 80, 'sun', 58, 3.3),
  g(15, 'Skyline Racers', 'Redline Interactive', 'Redline Interactive', ['Racing'], ['Racing', 'Arcade', 'Open World', 'Driving', 'Colorful'], 3499, 60, '2022-04-27', 'Arcade racing through a dozen sun-soaked coastal cities.', 200, 'ocean', 24, 31.5),
  g(16, 'Rogue Lantern', 'Lantern Lab', 'Lantern Lab', ['Roguelike', 'Indie'], ['Roguelike', 'Roguelite', 'Dungeon Crawler', 'Indie', 'Difficult'], 1999, 20, '2024-02-08', 'Every run is a new dungeon and every death teaches you something.', 40, 'dungeon', 49, 1.2),
  g(17, 'Cinder Court', 'Hearthstone Works', 'Hearthstone Works', ['Strategy', 'RPG'], ['Card Game', 'Deckbuilding', 'Strategy', 'Fantasy', 'Singleplayer'], 2499, 0, '2024-08-15', 'Rule a smoldering court by out-scheming rivals one card at a time.', 12, 'dungeon', 40, 2.9),
  g(18, 'Lunar Freight', 'Dust & Dynamo', 'Dust & Dynamo', ['Simulation', 'Space'], ['Space Sim', 'Trading', 'Management', 'Sandbox', 'Sci-fi'], 3499, 30, '2025-02-27', 'Haul cargo across a moon colony and keep the lights on.', 205, 'space', 33, 7.8),
  g(19, 'Paper Lanterns', 'Origami Owl', 'Origami Owl', ['Puzzle', 'Casual'], ['Puzzle', 'Relaxing', 'Cute', 'Short', 'Colorful'], 799, 0, '2023-12-01', 'Fold, light and float your way through a festival at dusk.', 25, 'sun', 20, 0.5),
  g(20, 'Redwood Run', 'Switchback Games', 'Switchback Games', ['Racing', 'Platformer'], ['Platformer', 'Racing', 'Fast-Paced', 'Speedrun', 'Cute'], 1599, 25, '2024-06-20', 'Sprint up giant trees in a time-trial platformer with zero brakes.', 20, 'forest', 30, 1.1),
  g(21, 'Abyssal Choir', 'Fathom Fiction', 'Fathom Fiction', ['Horror', 'Adventure'], ['Horror', 'Underwater', 'Atmospheric', 'Story Rich', 'First-Person'], 2799, 40, '2025-10-10', 'Something below is singing. It knows your name.', 210, 'ocean', 28, 14.2),
  g(22, 'Tidepool Tales', 'Shell & Pearl', 'Shell & Pearl', ['Adventure', 'Casual'], ['Cozy', 'Exploration', 'Relaxing', 'Cute', 'Nature'], 1499, 0, '2024-04-18', 'Befriend crabs, restock rock pools and uncover a small big mystery.', 175, 'ocean', 26, 2.4),
  g(23, 'Gridlock Heroes', 'Hexagon Hive', 'Hexagon Hive', ['Strategy', 'Action'], ['Tactical RPG', 'Superhero', 'Turn-Based', 'Grid-Based Movement', 'Strategy'], 3999, 50, '2023-10-05', 'Squads of misfit heroes defend a city that is mostly traffic.', 345, 'city', 35, 10.8),
  g(24, 'Sandstorm Syndicate', 'Mirage Machine', 'Mirage Machine', ['Action', 'Open World'], ['Open World', 'Crime', 'Action', 'Driving', 'Multiplayer'], 4999, 20, '2024-09-12', 'Build a smuggling empire across a desert that keeps rearranging itself.', 40, 'desert', 45, 61.0),
  g(25, 'Echo Garden', 'Soft Static', 'Soft Static', ['Adventure', 'Indie'], ['Walking Simulator', 'Atmospheric', 'Exploration', 'Story Rich', 'Short'], 1199, 0, '2022-07-07', 'Wander a garden that remembers every sound you make.', 135, 'forest', 12, 1.6),
  g(26, 'Ironbound', 'Rivet & Rune', 'Rivet & Rune', ['Roguelike', 'Action'], ['Roguelike', 'Action', 'Dark Fantasy', 'Difficult', 'Hack and Slash'], 2999, 35, '2025-05-22', 'Fight through a living fortress that rebuilds itself every night.', 8, 'dungeon', 52, 5.5),
  g(27, 'Skyfisher', 'Cloudline', 'Cloudline', ['Adventure', 'Casual'], ['Fishing', 'Relaxing', 'Exploration', 'Open World', 'Cute'], 1999, 15, '2023-08-24', 'Cast a line from an airship and see what bites among the clouds.', 195, 'sun', 30, 3.7),
  g(28, 'Mech Meridian', 'Titan Tin', 'Titan Tin', ['Action', 'Shooter'], ['Mechs', 'Action', 'Sci-fi', 'Multiplayer', 'Third-Person Shooter'], 3999, 45, '2024-03-29', 'Customize a battle mech and hold the line at the edge of the map.', 355, 'desert', 31, 28.9),
  g(29, 'Bakery Wars', 'Whisk & Co', 'Whisk & Co', ['Casual', 'Simulation'], ['Cooking', 'Casual', 'Funny', 'Co-op', 'Management'], 999, 0, '2022-02-14', 'Out-bake the shop across the street, one very serious croissant at a time.', 45, 'sun', 24, 0.9),
  g(30, 'Arena Zero', 'Bright Latch', 'Bright Latch', ['Shooter', 'Action'], ['Free to Play', 'FPS', 'Multiplayer', 'Competitive', 'Team-Based'], 0, 0, '2023-01-31', 'Fast, free team shooter with five-minute matches and zero loading screens.', 20, 'circuit', 56, 14.0),
])

export const priceOf = (x: Game) => Math.round(x.price * (1 - x.discount / 100))
export const fmt = (cents: number) => (cents === 0 ? 'Free' : `$${(cents / 100).toFixed(2)}`)

/** Steam-style review summary; fewer than 10 reviews shows no summary. */
export const reviewLabel = (rating: number, reviews = 1) =>
  reviews === 0 ? 'No user reviews' : reviews < 10 ? `${reviews} user review${reviews === 1 ? '' : 's'}`
  : rating >= 95 ? 'Overwhelmingly Positive' : rating >= 80 ? 'Very Positive' : rating >= 70 ? 'Mostly Positive' : rating >= 40 ? 'Mixed' : rating >= 20 ? 'Mostly Negative' : 'Overwhelmingly Negative'

export type Presence = 'online' | 'away' | 'offline' | 'ingame'

export const slug = (title: string) => title.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')
export const compact = (n: number) => n.toLocaleString('en-US')
export const GENRES: string[] = observable([...new Set(GAMES.flatMap(g => g.genre))].sort())
export const ALL_TAGS: string[] = observable([...new Set(GAMES.flatMap(g => g.tags))].sort())
/** Custom (browser-only) library entries live far above any server id. */
export const LOCAL_ID = 2_000_000_000
export const isLocal = (id: number) => id >= LOCAL_ID
