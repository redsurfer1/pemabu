-- Phase 1: Missing indexes and RLS completeness pass
-- Identified by audit Phase 0 (docs/AUDIT_REPORT.md).
-- All statements are IF NOT EXISTS / idempotent.

-- ── 1. marketplace_strategies: index on publisher_user_id ────────────
-- Column was added by 20260616130000 with no accompanying index.
-- Every "my published strategies" query does a full table scan without it.
CREATE INDEX IF NOT EXISTS marketplace_strategies_publisher_idx
  ON public.marketplace_strategies (publisher_user_id)
  WHERE publisher_user_id IS NOT NULL;

-- ── 2. sleeve_holdings: index on ticker ─────────────────────────────
-- Asset-class engine and cron routines look up holdings by ticker.
-- The existing idx_sleeve_holdings_sleeve_id covers (sleeve_id) only.
CREATE INDEX IF NOT EXISTS idx_sleeve_holdings_ticker
  ON public.sleeve_holdings (ticker);

-- ── 3. user_subscriptions: note on existing coverage ─────────────────
-- The UNIQUE (user_id, service_key) constraint already creates a B-tree
-- that supports WHERE user_id = $1 queries (user_id is the leading column).
-- No additional index is needed.

-- ── 4. model_assumptions: add DELETE RLS policy ─────────────────────
-- The existing migration created SELECT / INSERT / UPDATE policies only.
-- Without a DELETE policy, portfolio owners cannot remove their assumption rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'model_assumptions'
      AND policyname = 'Users can delete assumptions for their portfolios'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete assumptions for their portfolios"
        ON public.model_assumptions FOR DELETE
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.portfolios
            WHERE portfolios.id = model_assumptions.portfolio_id
              AND portfolios.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- ── 5. model_assumptions: add sleeve_type column ────────────────────
-- Enables two independent assumption groups: one for the Main sleeve and
-- one for the Income sleeve.  DEFAULT 'main' keeps existing rows valid.
ALTER TABLE public.model_assumptions
  ADD COLUMN IF NOT EXISTS sleeve_type text NOT NULL DEFAULT 'main'
    CHECK (sleeve_type IN ('main', 'income'));

-- Upgrade unique constraint from (portfolio_id) to (portfolio_id, sleeve_type).
-- PostgreSQL auto-names unique constraints as <table>_<column>_key.
-- The original migration used UNIQUE(portfolio_id), producing this name:
ALTER TABLE public.model_assumptions
  DROP CONSTRAINT IF EXISTS model_assumptions_portfolio_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS model_assumptions_portfolio_sleeve_uidx
  ON public.model_assumptions (portfolio_id, sleeve_type);

-- ── 6. price_cache: intentional open-access RLS note ─────────────────
-- price_cache is a shared performance cache (not user-private data).
-- "Authenticated users can read/write price cache" policies are intentional.
-- Any authenticated user can read any cached price. No policy change needed.

COMMENT ON TABLE public.model_assumptions IS
  'Per-portfolio scoring assumptions. One row per (portfolio_id, sleeve_type). '
  'sleeve_type: main = Main ETF sleeve, income = Income sleeve.';

COMMENT ON COLUMN public.model_assumptions.sleeve_type IS
  'Identifies which sleeve these assumptions apply to: main or income.';
