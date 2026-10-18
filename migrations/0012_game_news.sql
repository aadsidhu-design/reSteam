-- Announcements a developer posts for their own game; followers are notified.
CREATE TABLE game_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX game_news_game ON game_news (game_id, created_at DESC);
