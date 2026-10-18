-- Achievements a developer defines for their game. Unlocking stays playtime-based (see MINUTES_PER_ACHIEVEMENT).
CREATE TABLE game_achievements (
  game_id INTEGER NOT NULL REFERENCES games(id),
  idx INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (game_id, idx)
);
