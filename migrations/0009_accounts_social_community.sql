-- Placeholder data goes: seeded fake friends, bot chats and the anonymous demo accounts that owned them.
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS friends;
DELETE FROM redeemed;
DELETE FROM cart;
DELETE FROM wishlist;
DELETE FROM library;
DELETE FROM users;

-- Real accounts.
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN pass_hash TEXT;
ALTER TABLE users ADD COLUMN pass_salt TEXT;
ALTER TABLE users ADD COLUMN pass_iters INTEGER NOT NULL DEFAULT 100000;
ALTER TABLE users ADD COLUMN recovery_hash TEXT;
ALTER TABLE users ADD COLUMN recovery_salt TEXT;
ALTER TABLE users ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN playing_game INTEGER;
ALTER TABLE users ADD COLUMN playing_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN privacy TEXT NOT NULL DEFAULT 'public';
CREATE UNIQUE INDEX users_username ON users (username COLLATE NOCASE);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                 -- SHA-256 of the cookie token; the token itself is never stored
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  remember INTEGER NOT NULL DEFAULT 0,
  agent TEXT
);
CREATE INDEX sessions_user ON sessions (user_id);

-- Cross-device sign-in: a waiting browser shows a QR code, a signed-in device approves it.
CREATE TABLE qr_logins (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | used
  user_id TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Friends: one row per direction. A request is (A,B,'pending_out') + (B,A,'pending_in').
CREATE TABLE friendships (
  user_id TEXT NOT NULL REFERENCES users(id),
  friend_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,                      -- accepted | pending_out | pending_in
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX friendships_friend ON friendships (friend_id);
CREATE TABLE blocks (
  user_id TEXT NOT NULL REFERENCES users(id),
  blocked_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);

CREATE TABLE dms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id TEXT NOT NULL REFERENCES users(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX dms_pair ON dms (sender_id, recipient_id, id);
CREATE INDEX dms_inbox ON dms (recipient_id, read_at);

CREATE TABLE chat_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES chat_groups(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user ON group_members (user_id);
CREATE TABLE group_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES chat_groups(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX group_messages_group ON group_messages (group_id, id);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX notifications_user ON notifications (user_id, id);

-- What people did, shown to their friends.
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,                        -- playing | achievement | review | purchase | friend
  game_id INTEGER,
  data TEXT NOT NULL DEFAULT '{}',
  at INTEGER NOT NULL
);
CREATE INDEX events_user ON events (user_id, id);

-- Community content, written by real users.
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  recommend INTEGER NOT NULL,
  text TEXT NOT NULL,
  playtime INTEGER NOT NULL DEFAULT 0,       -- minutes on record when it was written
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (game_id, user_id)
);
CREATE INDEX reviews_game ON reviews (game_id, created_at);
CREATE TABLE review_votes (
  review_id INTEGER NOT NULL REFERENCES reviews(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,                        -- helpful | funny
  PRIMARY KEY (review_id, user_id, kind)
);
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,                        -- discussion | guide
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX posts_game ON posts (game_id, kind, created_at);
CREATE TABLE replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX replies_post ON replies (post_id, id);
CREATE TABLE post_votes (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  target TEXT NOT NULL,                      -- review:12, post:3, reply:9
  reason TEXT NOT NULL,
  at INTEGER NOT NULL
);

-- Personal store lists live with the account (the real store keeps them server-side too).
CREATE TABLE ignored (
  user_id TEXT NOT NULL REFERENCES users(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  PRIMARY KEY (user_id, game_id)
);
CREATE TABLE followed (
  user_id TEXT NOT NULL REFERENCES users(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  PRIMARY KEY (user_id, game_id)
);
