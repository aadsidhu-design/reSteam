-- reGuard: optional authenticator-app (TOTP) second factor, one-time backup codes, and an account security log.
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_pending TEXT;
ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN country TEXT;

CREATE TABLE guard_backup (
  user_id TEXT NOT NULL REFERENCES users(id),
  code_hash TEXT NOT NULL,
  used_at INTEGER,
  PRIMARY KEY (user_id, code_hash)
);

CREATE TABLE login_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,                  -- login, login_failed, guard_failed, guard_on, guard_off, password, sessions_revoked
  country TEXT,
  agent TEXT
);
CREATE INDEX login_events_user ON login_events (user_id, at DESC);
