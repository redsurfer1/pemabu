/*
  # Allocation Intelligence v3.2 — Schema Alignment

  Adds the missing fields identified in AUDIT_REPORT.md:
  1. sleeves.weighting_method
  2. sleeve_holdings.manual_pricing, manual_target_wt, sort_order
  3. sleeve_snapshots — 12 missing score/allocation fields
  4. price_cache — add ticker/period/cache_date columns alongside cache_key
     (cache_key retained for backwards compatibility)
*/

-- ── 1. Sleeves: add weighting_method ─────────────────────────────

ALTER TABLE sleeves
  ADD COLUMN IF NOT EXISTS weighting_method text NOT NULL DEFAULT 'COMPOSITE_SCORE'
    CHECK (weighting_method IN ('COMPOSITE_SCORE', 'YIELD_PROPORTIONAL', 'MANUAL'));

-- Back-fill from purpose for existing rows
UPDATE sleeves SET weighting_method = 'YIELD_PROPORTIONAL' WHERE purpose = 'Income';
UPDATE sleeves SET weighting_method = 'MANUAL'             WHERE purpose = 'Stability';

-- ── 2. Sleeve holdings: manual_pricing, manual_target_wt, sort_order ──

ALTER TABLE sleeve_holdings
  ADD COLUMN IF NOT EXISTS manual_pricing  boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_target_wt numeric             DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sort_order      integer   NOT NULL DEFAULT 0;

-- ── 3. Sleeve snapshots: add 12 missing score / allocation fields ──

ALTER TABLE sleeve_snapshots
  -- Per-holding scoring inputs
  ADD COLUMN IF NOT EXISTS vol_3mo           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sharpe_proxy      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS div_apy           numeric NOT NULL DEFAULT 0,
  -- PERCENTRANK scores 0-1
  ADD COLUMN IF NOT EXISTS pr_expense        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pr_return         numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pr_div_apy        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pr_sharpe         numeric NOT NULL DEFAULT 0,
  -- Allocation pipeline intermediate values
  ADD COLUMN IF NOT EXISTS raw_score_wt      numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equal_wt_base     numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS theme_capped_wt   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_target_wt   numeric NOT NULL DEFAULT 0,
  -- Parity dollar amounts (amt = target $, chg = delta from current)
  ADD COLUMN IF NOT EXISTS parity_dollar_amt numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parity_dollar_chg numeric NOT NULL DEFAULT 0;

-- Note: existing parity_dollar column retains its data and is kept for
-- backward compatibility. New code writes parity_dollar_chg; old reads
-- can still use parity_dollar.

-- ── 4. price_cache: add structured columns ────────────────────────

ALTER TABLE price_cache
  ADD COLUMN IF NOT EXISTS ticker     text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS period     text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cache_date text    DEFAULT NULL;

-- Back-fill structured columns from cache_key where parseable
-- Format: "current:TICKER" or "hist:TICKER:PERIOD:YYYY-MM-DD"
UPDATE price_cache
SET
  ticker     = CASE
                 WHEN cache_key LIKE 'current:%' THEN split_part(cache_key, ':', 2)
                 WHEN cache_key LIKE 'hist:%'    THEN split_part(cache_key, ':', 2)
                 ELSE NULL
               END,
  period     = CASE
                 WHEN cache_key LIKE 'current:%' THEN 'current'
                 WHEN cache_key LIKE 'hist:%'    THEN split_part(cache_key, ':', 3)
                 ELSE NULL
               END,
  cache_date = CASE
                 WHEN cache_key LIKE 'hist:%'    THEN split_part(cache_key, ':', 4)
                 ELSE to_char(fetched_at, 'YYYY-MM-DD')
               END
WHERE ticker IS NULL;

-- Create index for ticker+period lookups
CREATE INDEX IF NOT EXISTS idx_price_cache_ticker_period
  ON price_cache (ticker, period)
  WHERE ticker IS NOT NULL;

-- ── 5. Indexes for new columns ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sleeve_holdings_sort_order
  ON sleeve_holdings (sleeve_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_sleeves_weighting_method
  ON sleeves (weighting_method);
