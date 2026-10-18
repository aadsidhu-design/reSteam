-- Player-uploaded games. Files live in R2 under games/<id>/...; D1 holds only metadata.
ALTER TABLE games ADD COLUMN owner_id TEXT REFERENCES users(id);
ALTER TABLE games ADD COLUMN status TEXT NOT NULL DEFAULT 'published';   -- draft | published
ALTER TABLE games ADD COLUMN has_cover INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN web_entry TEXT;                              -- set when a browser-playable build was uploaded
ALTER TABLE games ADD COLUMN build_name TEXT;                             -- original name of the downloadable build
ALTER TABLE games ADD COLUMN build_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX games_owner ON games (owner_id);

-- Short-lived capability for loading a web game inside its sandboxed frame (the frame cannot send cookies).
CREATE TABLE play_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  game_id INTEGER NOT NULL REFERENCES games(id),
  expires_at INTEGER NOT NULL
);
CREATE INDEX play_tokens_exp ON play_tokens (expires_at);
