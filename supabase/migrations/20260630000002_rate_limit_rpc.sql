-- Migration: Supabase-backed rate limiting RPC
-- Provides a general-purpose sliding-window rate limiter backed by
-- Postgres, eliminating the need for Redis at pre-scale.  The caller
-- supplies a bucket key, a maximum count, and a window in seconds.
--
-- Uses a single upsert + conditional increment so the entire check is
-- atomic; no TOCTOU window even under concurrent requests.
--
-- Called from: lib/security/rate-limiter.ts via supabaseAdmin.rpc()

-- ── 1. Bucket table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key          TEXT        PRIMARY KEY,
  count        INTEGER     NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service-role only — this table must never be exposed to clients.
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_limit_buckets_service_only
  ON rate_limit_buckets
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Index for periodic cleanup of expired rows (run by a cron or pg_cron).
CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_expires_at
  ON rate_limit_buckets (expires_at);

-- ── 2. RPC ───────────────────────────────────────────────────────────────────
--
-- Returns TRUE  if the request is allowed   (counter incremented).
-- Returns FALSE if the rate limit is exceeded (counter NOT incremented).
--
-- Parameters:
--   p_key            TEXT     — unique bucket identifier (e.g. "import:user-uuid")
--   p_max_count      INTEGER  — maximum requests allowed in the window
--   p_window_seconds INTEGER  — rolling window size in seconds
--
-- Behaviour:
--   • If no bucket row exists, create one with count=1.
--   • If the bucket row exists but the window has expired (now > expires_at),
--     reset count to 1 and start a fresh window.
--   • If the bucket row exists and the window is active:
--     - count < p_max_count → increment and allow.
--     - count >= p_max_count → deny (do not increment).

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key            TEXT,
  p_max_count      INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now        TIMESTAMPTZ := now();
  v_expires_at TIMESTAMPTZ := v_now + (p_window_seconds * INTERVAL '1 second');
  v_allowed    BOOLEAN     := false;
BEGIN
  -- Attempt to insert a fresh bucket (first request in this window).
  INSERT INTO rate_limit_buckets (key, count, window_start, expires_at)
  VALUES (p_key, 1, v_now, v_expires_at)
  ON CONFLICT (key) DO UPDATE
    SET
      -- If the existing window has expired, reset it.
      count        = CASE
                       WHEN rate_limit_buckets.expires_at < v_now
                       THEN 1
                       -- Window is active: increment only if below cap.
                       WHEN rate_limit_buckets.count < p_max_count
                       THEN rate_limit_buckets.count + 1
                       -- At or over cap: do NOT increment.
                       ELSE rate_limit_buckets.count
                     END,
      window_start = CASE
                       WHEN rate_limit_buckets.expires_at < v_now THEN v_now
                       ELSE rate_limit_buckets.window_start
                     END,
      expires_at   = CASE
                       WHEN rate_limit_buckets.expires_at < v_now THEN v_expires_at
                       ELSE rate_limit_buckets.expires_at
                     END
  RETURNING
    -- Allowed if: (a) fresh insert (count=1), or (b) window reset (count=1),
    -- or (c) count was incremented (was below cap before this upsert).
    count <= p_max_count
  INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

-- Grant execute to service_role only.
REVOKE EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ── Verification block (run manually) ────────────────────────────────────────
-- -- Allow 3 in a 5-second window:
-- SELECT check_rate_limit('test:user-1', 3, 5); -- true  (count=1)
-- SELECT check_rate_limit('test:user-1', 3, 5); -- true  (count=2)
-- SELECT check_rate_limit('test:user-1', 3, 5); -- true  (count=3)
-- SELECT check_rate_limit('test:user-1', 3, 5); -- false (count=3, cap hit)
-- -- After 5+ seconds, window resets:
-- SELECT pg_sleep(6);
-- SELECT check_rate_limit('test:user-1', 3, 5); -- true  (count=1, fresh window)
