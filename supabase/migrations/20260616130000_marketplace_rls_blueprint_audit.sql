-- Marketplace: private blueprint_json, public leaderboard view, publisher + optional subscribers.
-- Audit: strategy import success event.

ALTER TABLE public.holding_audit_log
  DROP CONSTRAINT IF EXISTS holding_audit_log_event_type_check;

ALTER TABLE public.holding_audit_log
  ADD CONSTRAINT holding_audit_log_event_type_check
  CHECK (event_type IN (
    'ADD',
    'PARTIAL_SELL',
    'FULL_EXIT',
    'SLEEVE_REMOVED',
    'DRIFT_AFTER_REMOVAL',
    'TRADE_PROPOSAL_CREATED',
    'TRADE_PROPOSAL_APPROVED',
    'TRADE_PROPOSAL_REJECTED',
    'TRADE_EXECUTION_ATTEMPT',
    'TRADE_EXECUTION_SUCCESS',
    'TRADE_EXECUTION_FAILURE',
    'STRATEGY_IMPORT_SUCCESS'
  ));

-- Rename blueprint column (vault + hosted parity)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketplace_strategies' AND column_name = 'blueprint'
  ) THEN
    ALTER TABLE public.marketplace_strategies RENAME COLUMN blueprint TO blueprint_json;
  END IF;
END $$;

ALTER TABLE public.marketplace_strategies
  ADD COLUMN IF NOT EXISTS publisher_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.marketplace_strategy_subscribers (
  strategy_id uuid NOT NULL REFERENCES public.marketplace_strategies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (strategy_id, user_id)
);

CREATE INDEX IF NOT EXISTS marketplace_strategy_subscribers_user_idx
  ON public.marketplace_strategy_subscribers (user_id);

ALTER TABLE public.marketplace_strategy_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_strategy_subscribers_select_own"
  ON public.marketplace_strategy_subscribers
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "marketplace_strategies_select_all" ON public.marketplace_strategies;
DROP POLICY IF EXISTS "marketplace_strategies_insert_authenticated" ON public.marketplace_strategies;

CREATE POLICY "marketplace_strategies_select_owner_or_subscriber"
  ON public.marketplace_strategies
  FOR SELECT
  TO authenticated
  USING (
    publisher_user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.marketplace_strategy_subscribers s
      WHERE s.strategy_id = marketplace_strategies.id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "marketplace_strategies_insert_publisher"
  ON public.marketplace_strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    publisher_user_id IS NOT NULL
    AND publisher_user_id = (SELECT auth.uid())
  );

CREATE POLICY "marketplace_strategies_update_publisher"
  ON public.marketplace_strategies
  FOR UPDATE
  TO authenticated
  USING (publisher_user_id = (SELECT auth.uid()))
  WITH CHECK (publisher_user_id = (SELECT auth.uid()));

GRANT INSERT, UPDATE ON public.marketplace_strategies TO authenticated;

-- Public metrics only (definer view; omits blueprint_json and metadata).
CREATE OR REPLACE VIEW public.marketplace_leaderboard_public
WITH (security_invoker = false)
AS
SELECT
  id,
  display_name,
  strategy_grade,
  blueprint_adherence_score,
  vw_rsi_performance_score,
  published_at
FROM public.marketplace_strategies;

COMMENT ON VIEW public.marketplace_leaderboard_public IS
  'Privacy-safe leaderboard projection — no blueprint_json, no metadata, no balances.';

GRANT SELECT ON public.marketplace_leaderboard_public TO authenticated;

GRANT SELECT ON public.marketplace_strategy_subscribers TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT SELECT ON public.marketplace_leaderboard_public TO pemabu;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_strategy_subscribers TO pemabu;
  END IF;
END $$;
