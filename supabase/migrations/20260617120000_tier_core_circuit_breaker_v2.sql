-- Circuit breaker v2 (hard vs soft), PAUSED status, watcher cooldown,
-- public marketplace leaderboard read for anon.

-- ── Portfolios: PAUSED + streaks + watcher cooldown ─────────────────
ALTER TABLE public.portfolios
  DROP CONSTRAINT IF EXISTS portfolios_system_status_check;

ALTER TABLE public.portfolios
  ADD CONSTRAINT portfolios_system_status_check
  CHECK (system_status IN ('ACTIVE', 'LOCKED', 'PAUSED'));

COMMENT ON COLUMN public.portfolios.system_status IS
  'ACTIVE: normal. LOCKED: hard-fail safety halt (3 consecutive hard-class execution failures). PAUSED: soft-fail / network class (5 consecutive soft failures).';

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS execution_hard_fail_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_soft_fail_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watcher_cooldown_until timestamptz;

ALTER TABLE public.execution_errors
  ADD COLUMN IF NOT EXISTS failure_category text
    CHECK (failure_category IS NULL OR failure_category IN ('HARD', 'SOFT'));

COMMENT ON COLUMN public.execution_errors.failure_category IS
  'HARD: balance/key/reject class — counts toward safety lock. SOFT: timeout/rate-limit/transient — cooldown + soft streak toward PAUSED.';

-- Public leaderboard teaser (unauthenticated)
GRANT SELECT ON public.marketplace_leaderboard_public TO anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT SELECT ON public.user_subscriptions TO pemabu;
  END IF;
END $$;
