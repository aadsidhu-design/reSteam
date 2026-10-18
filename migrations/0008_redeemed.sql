CREATE TABLE redeemed (
  user_id TEXT NOT NULL REFERENCES users(id),
  code TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, code)
);
