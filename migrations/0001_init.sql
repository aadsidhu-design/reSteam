CREATE TABLE users (
  id TEXT PRIMARY KEY,
  wallet INTEGER NOT NULL DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'online',
  created_at INTEGER NOT NULL
);
CREATE TABLE games (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  dev TEXT NOT NULL,
  genre TEXT NOT NULL,
  price INTEGER NOT NULL,
  discount INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  released TEXT NOT NULL,
  blurb TEXT NOT NULL,
  hue INTEGER NOT NULL,
  icon TEXT NOT NULL
);
CREATE TABLE library (
  user_id TEXT NOT NULL REFERENCES users(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  installed INTEGER NOT NULL DEFAULT 0,
  playtime INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, game_id)
);
CREATE TABLE wishlist (
  user_id TEXT NOT NULL REFERENCES users(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  PRIMARY KEY (user_id, game_id)
);
CREATE TABLE cart (
  user_id TEXT NOT NULL REFERENCES users(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  PRIMARY KEY (user_id, game_id)
);
CREATE TABLE friends (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hue INTEGER NOT NULL,
  status TEXT NOT NULL,
  game_id INTEGER REFERENCES games(id)
);
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  friend_id TEXT NOT NULL REFERENCES friends(id),
  from_me INTEGER NOT NULL,
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX messages_thread ON messages (user_id, friend_id, id);
