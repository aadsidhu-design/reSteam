-- Purchases remember when and for how much, so they can be refunded under the usual rules.
ALTER TABLE library ADD COLUMN acquired_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE library ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
CREATE TABLE refunds (
  user_id TEXT NOT NULL REFERENCES users(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  cents INTEGER NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, game_id)
);
