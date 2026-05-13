-- Sovereign portfolio layer: cost basis, tax lots, RSI on sleeve holdings,
-- append-only institutional memory (local audit trail), partial unique indexes.

ALTER TABLE public.sleeve_holdings
  ADD COLUMN IF NOT EXISTS cost_basis numeric(18, 4),
  ADD COLUMN IF NOT EXISTS tax_lot_label text,
  ADD COLUMN IF NOT EXISTS rsi_14 numeric(10, 4);

COMMENT ON COLUMN public.sleeve_holdings.cost_basis IS 'Total cost basis for the position (precision stored server-side; app uses Decimal.js).';
COMMENT ON COLUMN public.sleeve_holdings.tax_lot_label IS 'When set, duplicate tickers in the same sleeve are allowed as separate tax lots.';
COMMENT ON COLUMN public.sleeve_holdings.rsi_14 IS 'Optional RSI(14) for sleeve- and portfolio-level aggregation.';

ALTER TABLE public.sleeve_holdings
  DROP CONSTRAINT IF EXISTS sleeve_holdings_tax_lot_label_nonempty;

ALTER TABLE public.sleeve_holdings
  ADD CONSTRAINT sleeve_holdings_tax_lot_label_nonempty
  CHECK (tax_lot_label IS NULL OR length(trim(tax_lot_label)) > 0);

-- At most one "default" row per ticker per sleeve (no tax lot label).
CREATE UNIQUE INDEX IF NOT EXISTS sleeve_holdings_one_default_ticker_per_sleeve
  ON public.sleeve_holdings (sleeve_id, upper(trim(ticker)))
  WHERE tax_lot_label IS NULL;

-- Distinct tax lots for the same ticker in one sleeve.
CREATE UNIQUE INDEX IF NOT EXISTS sleeve_holdings_distinct_tax_lot
  ON public.sleeve_holdings (sleeve_id, upper(trim(ticker)), tax_lot_label)
  WHERE tax_lot_label IS NOT NULL;

-- Append-only audit trail (no UPDATE/DELETE policies for authenticated).
CREATE TABLE IF NOT EXISTS public.holding_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  portfolio_id uuid NOT NULL REFERENCES public.portfolios (id) ON DELETE CASCADE,
  sleeve_id uuid REFERENCES public.sleeves (id) ON DELETE SET NULL,
  holding_id uuid,
  event_type text NOT NULL
    CHECK (event_type IN (
      'ADD',
      'PARTIAL_SELL',
      'FULL_EXIT',
      'SLEEVE_REMOVED',
      'DRIFT_AFTER_REMOVAL'
    )),
  ticker text NOT NULL,
  quantity_before numeric(24, 8),
  quantity_after numeric(24, 8),
  cost_basis_before numeric(18, 4),
  cost_basis_after numeric(18, 4),
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holding_audit_log_portfolio_created_idx
  ON public.holding_audit_log (portfolio_id, created_at DESC);

ALTER TABLE public.holding_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holding_audit_log_select_owner"
  ON public.holding_audit_log
  FOR SELECT
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "holding_audit_log_insert_owner"
  ON public.holding_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND portfolio_id IN (
      SELECT id FROM public.portfolios
      WHERE user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON public.holding_audit_log TO authenticated;
