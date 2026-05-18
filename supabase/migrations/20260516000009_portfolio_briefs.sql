-- Migration: portfolio_briefs
-- Stores generated AI portfolio briefs with 24-hour cooldown enforcement.
-- Phase-5 of the Allocation Intelligence Audit.

CREATE TABLE IF NOT EXISTS portfolio_briefs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_text   text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Only the most-recent brief per portfolio matters; partial index for cooldown check.
CREATE INDEX IF NOT EXISTS portfolio_briefs_portfolio_generated
  ON portfolio_briefs (portfolio_id, generated_at DESC);

-- RLS: users see only their own briefs.
ALTER TABLE portfolio_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_briefs_owner_select"
  ON portfolio_briefs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "portfolio_briefs_owner_insert"
  ON portfolio_briefs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE policies — briefs are immutable append-only records.
