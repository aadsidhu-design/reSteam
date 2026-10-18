CREATE TABLE news_likes (
  news_id INTEGER NOT NULL REFERENCES game_news(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (news_id, user_id)
);
CREATE TABLE news_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  news_id INTEGER NOT NULL REFERENCES game_news(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX news_comments_news ON news_comments (news_id, created_at);
