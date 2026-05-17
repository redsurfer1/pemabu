-- Ten-factor weights on model_assumptions (dashboard v3 path).

ALTER TABLE public.model_assumptions
  ADD COLUMN IF NOT EXISTS factor_target_allocation numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_weighted_return numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_expense numeric NOT NULL DEFAULT 0.12,
  ADD COLUMN IF NOT EXISTS factor_pct_weight numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_div_apy numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_volatility numeric NOT NULL DEFAULT 0.13,
  ADD COLUMN IF NOT EXISTS factor_thirteen_f numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_macro_intelligence numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_governance_layer numeric NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS factor_political_tracker numeric NOT NULL DEFAULT 0.075,
  ADD COLUMN IF NOT EXISTS factor_token_quality numeric NOT NULL DEFAULT 0.075;

COMMENT ON COLUMN public.model_assumptions.factor_thirteen_f IS
  'Composite weight: 13F institutional flow score.';
