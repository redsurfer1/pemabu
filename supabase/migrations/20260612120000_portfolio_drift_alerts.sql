-- Local vault / Watcher: drift alerts (no tickers required in table; worker stores UUID refs only).

CREATE TABLE IF NOT EXISTS public.portfolio_drift_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios (id) ON DELETE CASCADE,
  sleeve_id uuid REFERENCES public.sleeves (id) ON DELETE SET NULL,
  holding_id uuid,
  drift_pct numeric(14, 8) NOT NULL,
  metric text NOT NULL DEFAULT 'TARGET_WEIGHT',
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_drift_alerts_portfolio_detected_idx
  ON public.portfolio_drift_alerts (portfolio_id, detected_at DESC);

COMMENT ON TABLE public.portfolio_drift_alerts IS
  'Watcher drift detections; relay payloads must never echo row contents.';
