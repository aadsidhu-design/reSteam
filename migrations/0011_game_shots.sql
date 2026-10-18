ALTER TABLE games ADD COLUMN shots INTEGER NOT NULL DEFAULT 0;   -- number of uploaded screenshots (games/<id>/shot/0..n-1)
