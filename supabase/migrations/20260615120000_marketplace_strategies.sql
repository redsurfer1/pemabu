-- Strategy marketplace (Phase 1): privacy-first leaderboard rows; vault execution plane compatible.

CREATE TABLE IF NOT EXISTS public.marketplace_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sleeve_token_hash text NOT NULL,
  display_name text NOT NULL,
  blueprint jsonb NOT NULL,
  strategy_grade numeric(6, 2) NOT NULL DEFAULT 0,
  blueprint_adherence_score numeric(6, 2) NOT NULL DEFAULT 0,
  vw_rsi_performance_score numeric(10, 4) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_strategies_token_hash_uidx
  ON public.marketplace_strategies (sleeve_token_hash);

CREATE INDEX IF NOT EXISTS marketplace_strategies_grade_idx
  ON public.marketplace_strategies (strategy_grade DESC, published_at DESC);

COMMENT ON TABLE public.marketplace_strategies IS
  'Anonymized sleeve blueprints and aggregate grades only — no tickers, balances, or account identifiers.';

ALTER TABLE public.marketplace_strategies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "marketplace_strategies_select_all"
    ON public.marketplace_strategies FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "marketplace_strategies_insert_authenticated"
    ON public.marketplace_strategies FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON public.marketplace_strategies TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT SELECT, INSERT ON public.marketplace_strategies TO pemabu;
  END IF;
END $$;
