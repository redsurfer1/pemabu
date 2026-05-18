-- Expand portfolio_assumptions to 10 factor weights (sovereign + institutional primitives).
-- Creates the table when missing (remote may have skipped 20250003000001).

CREATE TABLE IF NOT EXISTS public.portfolio_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  weight_3mo numeric NOT NULL DEFAULT 0.40,
  weight_6mo numeric NOT NULL DEFAULT 0.25,
  weight_1yr numeric NOT NULL DEFAULT 0.20,
  weight_3yr numeric NOT NULL DEFAULT 0.10,
  weight_5yr numeric NOT NULL DEFAULT 0.05,
  factor_expense numeric NOT NULL DEFAULT 0.30,
  factor_pct_weight numeric NOT NULL DEFAULT 0.30,
  factor_div_apy numeric NOT NULL DEFAULT 0.15,
  factor_volatility numeric NOT NULL DEFAULT 0.25,
  factor_target_allocation numeric NOT NULL DEFAULT 0.10,
  factor_weighted_return numeric NOT NULL DEFAULT 0.10,
  factor_thirteen_f numeric NOT NULL DEFAULT 0.10,
  factor_macro_intelligence numeric NOT NULL DEFAULT 0.10,
  factor_governance_layer numeric NOT NULL DEFAULT 0.10,
  factor_political_tracker numeric NOT NULL DEFAULT 0.075,
  factor_token_quality numeric NOT NULL DEFAULT 0.075,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (portfolio_id)
);

ALTER TABLE public.portfolio_assumptions
  ADD COLUMN IF NOT EXISTS factor_target_allocation numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_weighted_return numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_thirteen_f numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_macro_intelligence numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_governance_layer numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_political_tracker numeric NOT NULL DEFAULT 0.075,
  ADD COLUMN IF NOT EXISTS factor_token_quality numeric NOT NULL DEFAULT 0.075;

ALTER TABLE public.portfolio_assumptions ENABLE ROW LEVEL SECURITY;

DO $policy$ BEGIN
  CREATE POLICY "owner access"
    ON public.portfolio_assumptions
    FOR ALL
    USING (
      portfolio_id IN (
        SELECT id FROM public.portfolios WHERE user_id = auth.uid()
      )
    )
    WITH CHECK (
      portfolio_id IN (
        SELECT id FROM public.portfolios WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $policy$;

COMMENT ON COLUMN public.portfolio_assumptions.factor_thirteen_f IS
  'Composite weight: 13F institutional inflow / scent score.';
COMMENT ON COLUMN public.portfolio_assumptions.factor_macro_intelligence IS
  'Composite weight: macroeconomic regime alignment.';
COMMENT ON COLUMN public.portfolio_assumptions.factor_governance_layer IS
  'Composite weight: on-chain / structural governance robustness.';
COMMENT ON COLUMN public.portfolio_assumptions.factor_political_tracker IS
  'Composite weight: regulatory & geopolitical risk rating.';
COMMENT ON COLUMN public.portfolio_assumptions.factor_token_quality IS
  'Composite weight: smart contract / asset quality grade.';

-- Optional per-holding factor scores (0–1); populated by intelligence refresh pipelines.
ALTER TABLE public.portfolio_holdings
  ADD COLUMN IF NOT EXISTS score_thirteen_f numeric,
  ADD COLUMN IF NOT EXISTS score_macro_intelligence numeric,
  ADD COLUMN IF NOT EXISTS score_governance_layer numeric,
  ADD COLUMN IF NOT EXISTS score_political_tracker numeric,
  ADD COLUMN IF NOT EXISTS score_token_quality numeric;
