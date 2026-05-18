-- sleeve_performance_log: weekly snapshots for published marketplace strategies.
-- Privacy: percentages and scores only — no dollar values, no user IDs.
-- Idempotency: UNIQUE (sleeve_id, recorded_week).

CREATE TABLE IF NOT EXISTS public.sleeve_performance_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sleeve_id             UUID NOT NULL,
  recorded_week         DATE NOT NULL,
  avg_drift_pct         NUMERIC(6, 3),
  max_drift_pct         NUMERIC(6, 3),
  entry_signal_count    INTEGER NOT NULL DEFAULT 0,
  hold_signal_count     INTEGER NOT NULL DEFAULT 0,
  exit_signal_count     INTEGER NOT NULL DEFAULT 0,
  total_holdings_count  INTEGER NOT NULL DEFAULT 0,
  avg_composite_score   NUMERIC(6, 3),
  grade                 TEXT,
  was_published         BOOLEAN NOT NULL DEFAULT true,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sleeve_performance_log_unique_week
    UNIQUE (sleeve_id, recorded_week)
);

ALTER TABLE public.sleeve_performance_log
  ADD CONSTRAINT fk_sleeve_performance_log_sleeve
  FOREIGN KEY (sleeve_id)
  REFERENCES public.marketplace_strategies (id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sleeve_perf_log_sleeve_week
  ON public.sleeve_performance_log (sleeve_id, recorded_week DESC);

CREATE INDEX IF NOT EXISTS idx_sleeve_perf_log_week
  ON public.sleeve_performance_log (recorded_week DESC);

ALTER TABLE public.sleeve_performance_log ENABLE ROW LEVEL SECURITY;

DO $policy$ BEGIN
  CREATE POLICY "sleeve_performance_log_public_read"
    ON public.sleeve_performance_log FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $policy$;

COMMENT ON TABLE public.sleeve_performance_log IS
  'Weekly performance snapshots for published marketplace strategies. '
  'Historical factual data only — not predictions of future performance. '
  'Gate full history to Intelligence tier in application layer.';

COMMENT ON COLUMN public.sleeve_performance_log.avg_drift_pct IS
  'Average absolute drift (%) from target weights across holdings. Lower = closer to targets.';

COMMENT ON COLUMN public.sleeve_performance_log.recorded_week IS
  'ISO week start (Monday). One row per strategy per week.';
