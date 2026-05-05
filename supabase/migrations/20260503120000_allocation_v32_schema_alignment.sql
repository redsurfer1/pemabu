-- Allocation Intelligence v3.2 — align sleeves, holdings, snapshots, price_cache with spec
-- (Supabase migrations are authoritative; no Prisma in this repo per project constraints.)

-- Sleeves: weighting method for COMPOSITE_SCORE | YIELD_PROPORTIONAL | MANUAL
ALTER TABLE sleeves
  ADD COLUMN IF NOT EXISTS weighting_method text NOT NULL DEFAULT 'COMPOSITE_SCORE';

COMMENT ON COLUMN sleeves.weighting_method IS 'COMPOSITE_SCORE | YIELD_PROPORTIONAL | MANUAL';

-- Sleeve holdings: manual pricing / targets / ordering
ALTER TABLE sleeve_holdings
  ADD COLUMN IF NOT EXISTS manual_pricing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_target_wt numeric,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Snapshots: extended metrics for audit + UI
ALTER TABLE sleeve_snapshots
  ADD COLUMN IF NOT EXISTS pr_expense numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pr_return numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pr_div_apy numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pr_sharpe numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vol_3mo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sharpe_proxy numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS div_apy numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_score_wt numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equal_wt_base numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS theme_capped_wt numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parity_dollar_amt numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parity_dollar_chg numeric NOT NULL DEFAULT 0;

-- Migrate legacy parity_dollar into parity_dollar_amt when amt column was empty usage
UPDATE sleeve_snapshots
SET parity_dollar_amt = parity_dollar
WHERE parity_dollar_amt = 0 AND parity_dollar IS NOT NULL AND parity_dollar <> 0;

-- Price cache: structured keys (spec unique [ticker, period, cache_date])
ALTER TABLE price_cache
  ADD COLUMN IF NOT EXISTS ticker text,
  ADD COLUMN IF NOT EXISTS period text,
  ADD COLUMN IF NOT EXISTS cache_date date;

CREATE UNIQUE INDEX IF NOT EXISTS price_cache_ticker_period_date_uidx
  ON price_cache (ticker, period, cache_date)
  WHERE ticker IS NOT NULL AND period IS NOT NULL AND cache_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS price_cache_ticker_period_idx
  ON price_cache (ticker, period)
  WHERE ticker IS NOT NULL AND period IS NOT NULL;
