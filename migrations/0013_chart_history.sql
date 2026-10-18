-- One row per game per chart per day, so charts can show rank movement and weeks on the chart.
CREATE TABLE chart_snapshots (
  day TEXT NOT NULL,            -- UTC date, YYYY-MM-DD
  kind TEXT NOT NULL,           -- topselling | mostplayed | wishlisted | new
  game_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  PRIMARY KEY (day, kind, game_id)
);
CREATE INDEX chart_snapshots_game ON chart_snapshots (kind, game_id, day);
