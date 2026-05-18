-- Portfolio engine row status: Active positions, Comparable (stale data), Watch (fiat/USD watchlist).

ALTER TABLE public.portfolio_holdings
  ADD COLUMN IF NOT EXISTS row_status text NOT NULL DEFAULT 'Active';

ALTER TABLE public.portfolio_holdings
  DROP CONSTRAINT IF EXISTS portfolio_holdings_row_status_check;

ALTER TABLE public.portfolio_holdings
  ADD CONSTRAINT portfolio_holdings_row_status_check
  CHECK (row_status IN ('Active', 'Comparable', 'Watch'));

CREATE INDEX IF NOT EXISTS portfolio_holdings_row_status_idx
  ON public.portfolio_holdings (portfolio_id, row_status);

COMMENT ON COLUMN public.portfolio_holdings.row_status IS
  'Engine dashboard status: Active (held), Comparable (market data error), Watch (USD fiat watchlist, no position).';
