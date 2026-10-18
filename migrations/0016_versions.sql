ALTER TABLE games ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE game_versions (
  game_id INTEGER NOT NULL REFERENCES games(id),
  version INTEGER NOT NULL,
  notes TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (game_id, version)
);
