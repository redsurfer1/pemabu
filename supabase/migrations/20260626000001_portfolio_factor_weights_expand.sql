-- Expand portfolio_assumptions to 10 factor weights (sovereign + institutional primitives).

ALTER TABLE public.portfolio_assumptions
  ADD COLUMN IF NOT EXISTS factor_target_allocation numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_weighted_return numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_thirteen_f numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_macro_intelligence numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_governance_layer numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_political_tracker numeric NOT NULL DEFAULT 0.075,
  ADD COLUMN IF NOT EXISTS factor_token_quality numeric NOT NULL DEFAULT 0.075;

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
