/*
  # Allocation Intelligence v3.2 — Sleeves & Snapshots

  1. New Tables
    - `sleeves`
      - `id` (uuid, primary key)
      - `portfolio_id` (uuid, FK to portfolios)
      - `name` (text) — e.g. "Main ETF", "Income", "Fidelity/Cash"
      - `purpose` (text) — e.g. "Appreciation", "Income", "Stability"
      - `budget_pct` (numeric) — e.g. 0.88, 0.12
      - `sort_order` (integer) — display order
      - `is_active` (boolean, default true)
      - `created_at` / `updated_at` timestamps

    - `sleeve_holdings`
      - `id` (uuid, primary key)
      - `sleeve_id` (uuid, FK to sleeves)
      - `ticker` (text)
      - `name` (text)
      - `status` (text) — "Active" or "Comparable"
      - `theme` (text) — "Tech", "Intl", etc.
      - `qty` (numeric)
      - `price_seed` (numeric) — current price
      - `expense_ratio` (numeric)
      - `div_dollar` (numeric)
      - `target_wt_pct` (numeric) — final target weight
      - `created_at` / `updated_at` timestamps

    - `sleeve_snapshots`
      - `id` (uuid, primary key)
      - `holding_id` (uuid, FK to sleeve_holdings)
      - `date` (date)
      - computed metrics per holding per day
      - price history fields

    - `model_assumptions`
      - `id` (uuid, primary key)
      - `portfolio_id` (uuid, FK to portfolios)
      - return period weights (sum to 1.0)
      - composite scoring weights (sum to 1.0)
      - allocation controls

    - `price_cache`
      - cached historical/current prices with 24h TTL

  2. Security
    - RLS enabled on all new tables
    - Sleeves: accessible only through owned portfolio
    - Holdings: accessible only through owned sleeve
    - Snapshots: read-only for portfolio owner
    - Assumptions: SELECT/UPDATE for portfolio owner
*/

-- Sleeves table
CREATE TABLE IF NOT EXISTS sleeves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  name text NOT NULL,
  purpose text NOT NULL DEFAULT 'Appreciation',
  budget_pct numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sleeves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sleeves of their portfolios"
  ON sleeves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = sleeves.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sleeves into their portfolios"
  ON sleeves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = sleeves.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sleeves in their portfolios"
  ON sleeves FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = sleeves.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = sleeves.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sleeves in their portfolios"
  ON sleeves FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = sleeves.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

-- Sleeve holdings table
CREATE TABLE IF NOT EXISTS sleeve_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sleeve_id uuid NOT NULL REFERENCES sleeves(id) ON DELETE CASCADE,
  ticker text NOT NULL,
  name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  theme text NOT NULL DEFAULT 'Broad',
  qty numeric NOT NULL DEFAULT 0,
  price_seed numeric NOT NULL DEFAULT 0,
  expense_ratio numeric NOT NULL DEFAULT 0,
  div_dollar numeric NOT NULL DEFAULT 0,
  target_wt_pct numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sleeve_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view holdings in their sleeves"
  ON sleeve_holdings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sleeves
      JOIN portfolios ON portfolios.id = sleeves.portfolio_id
      WHERE sleeves.id = sleeve_holdings.sleeve_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert holdings in their sleeves"
  ON sleeve_holdings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sleeves
      JOIN portfolios ON portfolios.id = sleeves.portfolio_id
      WHERE sleeves.id = sleeve_holdings.sleeve_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update holdings in their sleeves"
  ON sleeve_holdings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sleeves
      JOIN portfolios ON portfolios.id = sleeves.portfolio_id
      WHERE sleeves.id = sleeve_holdings.sleeve_id
      AND portfolios.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sleeves
      JOIN portfolios ON portfolios.id = sleeves.portfolio_id
      WHERE sleeves.id = sleeve_holdings.sleeve_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete holdings in their sleeves"
  ON sleeve_holdings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sleeves
      JOIN portfolios ON portfolios.id = sleeves.portfolio_id
      WHERE sleeves.id = sleeve_holdings.sleeve_id
      AND portfolios.user_id = auth.uid()
    )
  );

-- Sleeve snapshots table (daily computed values)
CREATE TABLE IF NOT EXISTS sleeve_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id uuid NOT NULL REFERENCES sleeve_holdings(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  price numeric NOT NULL DEFAULT 0,
  value numeric NOT NULL DEFAULT 0,
  current_wt_pct numeric NOT NULL DEFAULT 0,
  target_wt_pct numeric NOT NULL DEFAULT 0,
  parity_gap_pct numeric NOT NULL DEFAULT 0,
  parity_dollar numeric NOT NULL DEFAULT 0,
  blended_return numeric NOT NULL DEFAULT 0,
  composite_score numeric NOT NULL DEFAULT 0,
  score_rank integer,
  vol_cap_flag text NOT NULL DEFAULT 'N/A',
  theme_exposure_pct numeric NOT NULL DEFAULT 0,
  signal text NOT NULL DEFAULT 'Hold',
  ret_3mo numeric NOT NULL DEFAULT 0,
  ret_6mo numeric NOT NULL DEFAULT 0,
  ret_1yr numeric NOT NULL DEFAULT 0,
  ret_3yr numeric NOT NULL DEFAULT 0,
  ret_5yr numeric NOT NULL DEFAULT 0,
  price_3mo numeric NOT NULL DEFAULT 0,
  price_6mo numeric NOT NULL DEFAULT 0,
  price_1yr numeric NOT NULL DEFAULT 0,
  price_3yr numeric NOT NULL DEFAULT 0,
  price_5yr numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sleeve_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view snapshots of their holdings"
  ON sleeve_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sleeve_holdings
      JOIN sleeves ON sleeves.id = sleeve_holdings.sleeve_id
      JOIN portfolios ON portfolios.id = sleeves.portfolio_id
      WHERE sleeve_holdings.id = sleeve_snapshots.holding_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert snapshots"
  ON sleeve_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sleeve_holdings
      JOIN sleeves ON sleeves.id = sleeve_holdings.sleeve_id
      JOIN portfolios ON portfolios.id = sleeves.portfolio_id
      WHERE sleeve_holdings.id = sleeve_snapshots.holding_id
      AND portfolios.user_id = auth.uid()
    )
  );

-- Model assumptions table
CREATE TABLE IF NOT EXISTS model_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ret_weight_3mo numeric NOT NULL DEFAULT 0.40,
  ret_weight_6mo numeric NOT NULL DEFAULT 0.25,
  ret_weight_1yr numeric NOT NULL DEFAULT 0.20,
  ret_weight_3yr numeric NOT NULL DEFAULT 0.10,
  ret_weight_5yr numeric NOT NULL DEFAULT 0.05,
  score_weight_exp numeric NOT NULL DEFAULT 0.30,
  score_weight_ret numeric NOT NULL DEFAULT 0.30,
  score_weight_div numeric NOT NULL DEFAULT 0.15,
  score_weight_shp numeric NOT NULL DEFAULT 0.25,
  income_budget_pct numeric NOT NULL DEFAULT 0.12,
  vol_cap_multiplier numeric NOT NULL DEFAULT 3.0,
  theme_cap_pct numeric NOT NULL DEFAULT 0.10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id)
);

ALTER TABLE model_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assumptions for their portfolios"
  ON model_assumptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = model_assumptions.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert assumptions for their portfolios"
  ON model_assumptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = model_assumptions.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update assumptions for their portfolios"
  ON model_assumptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = model_assumptions.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = model_assumptions.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

-- Price cache table (for historical and current prices)
CREATE TABLE IF NOT EXISTS price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  price numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  ttl_seconds integer NOT NULL DEFAULT 86400
);

ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read price cache"
  ON price_cache FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert price cache"
  ON price_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update price cache"
  ON price_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sleeves_portfolio_id ON sleeves(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_sleeve_holdings_sleeve_id ON sleeve_holdings(sleeve_id);
CREATE INDEX IF NOT EXISTS idx_sleeve_snapshots_holding_id ON sleeve_snapshots(holding_id);
CREATE INDEX IF NOT EXISTS idx_sleeve_snapshots_date ON sleeve_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_model_assumptions_portfolio_id ON model_assumptions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_price_cache_key ON price_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_price_cache_fetched ON price_cache(fetched_at);
