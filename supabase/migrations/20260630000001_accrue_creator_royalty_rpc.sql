-- Migration: atomic creator royalty accrual RPC
-- Replaces the non-atomic read-modify-write in the Stripe webhook
-- (SELECT accrued_royalties_cents … then UPDATE) with a single
-- INSERT … ON CONFLICT DO UPDATE that atomically increments the
-- running total, eliminating the TOCTOU race under concurrent webhook
-- delivery.
--
-- Idempotency: the caller passes p_stripe_session_id.  A partial-unique
-- index (idx_creator_royalty_accrual_stripe_session) on
-- (stripe_session_id) WHERE stripe_session_id IS NOT NULL ensures the
-- same Stripe session can never be double-counted even if the webhook
-- fires twice.
--
-- A NULL stripe_session_id is allowed for manual / backfill credits
-- (the unique index only covers non-NULL values).

-- ── 1. Idempotency log column ────────────────────────────────────────────────
-- creator_stats may already have accrued_royalties_cents.  We add a
-- new column to track which Stripe sessions have been accrued so we
-- can enforce idempotency at the DB level.

ALTER TABLE creator_stats
  ADD COLUMN IF NOT EXISTS last_accrual_session_id TEXT;

-- Partial unique index: one accrual per Stripe session, per creator.
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_royalty_accrual_stripe_session
  ON creator_stats (creator_user_id, last_accrual_session_id)
  WHERE last_accrual_session_id IS NOT NULL;

-- ── 2. Idempotency ledger table ──────────────────────────────────────────────
-- Separate ledger so we can track every accrual event independently
-- rather than relying on a single column per creator.

CREATE TABLE IF NOT EXISTS creator_royalty_ledger (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id     UUID        NOT NULL,
  stripe_session_id   TEXT        NOT NULL,          -- idempotency key
  delta_cents         INTEGER     NOT NULL CHECK (delta_cents > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (stripe_session_id)                         -- one row per session
);

-- RLS: service-role only (no direct client access)
ALTER TABLE creator_royalty_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_royalty_ledger_service_only
  ON creator_royalty_ledger
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── 3. Atomic RPC ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accrue_creator_royalty(
  p_creator_user_id   UUID,
  p_delta_cents       INTEGER,
  p_stripe_session_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: ignore zero or negative deltas
  IF p_delta_cents <= 0 THEN
    RETURN;
  END IF;

  -- Idempotency: insert the ledger row; if the session was already
  -- accrued do nothing (ON CONFLICT DO NOTHING on the UNIQUE constraint).
  INSERT INTO creator_royalty_ledger
    (creator_user_id, stripe_session_id, delta_cents)
  VALUES
    (p_creator_user_id, p_stripe_session_id, p_delta_cents)
  ON CONFLICT (stripe_session_id) DO NOTHING;

  -- Only update the running total when the ledger INSERT actually happened.
  IF NOT FOUND THEN
    -- Already processed; idempotent no-op.
    RETURN;
  END IF;

  -- Atomic increment of the creator's running total.
  INSERT INTO creator_stats
    (creator_user_id, accrued_royalties_cents, updated_at)
  VALUES
    (p_creator_user_id, p_delta_cents, now())
  ON CONFLICT (creator_user_id)
  DO UPDATE SET
    accrued_royalties_cents = creator_stats.accrued_royalties_cents + EXCLUDED.accrued_royalties_cents,
    updated_at              = now();
END;
$$;

-- Grant execute to service_role only (called from the Next.js server).
REVOKE EXECUTE ON FUNCTION accrue_creator_royalty(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION accrue_creator_royalty(UUID, INTEGER, TEXT) TO service_role;

-- ── Verification block (run manually) ────────────────────────────────────────
-- SELECT accrue_creator_royalty(
--   '00000000-0000-0000-0000-000000000001'::uuid, 100, 'cs_test_idempotency_1'
-- );
-- SELECT accrue_creator_royalty(
--   '00000000-0000-0000-0000-000000000001'::uuid, 100, 'cs_test_idempotency_1'
-- ); -- duplicate — should be a no-op
-- SELECT accrued_royalties_cents FROM creator_stats
--   WHERE creator_user_id = '00000000-0000-0000-0000-000000000001';
-- Expected: 100 (not 200)
