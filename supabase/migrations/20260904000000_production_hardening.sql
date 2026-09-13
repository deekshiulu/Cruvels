-- Production hardening: forced password rotation + shared rate-limit table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limits FROM anon, authenticated;
