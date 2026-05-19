-- 20260710000003_performance_tracking.sql
-- Aggregate performance summary per strategy for leaderboard display.

CREATE TABLE IF NOT EXISTS public.strategy_performance_summary (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id        uuid NOT NULL UNIQUE REFERENCES public.marketplace_strategies (id) ON DELETE CASCADE,
  total_weeks_tracked integer NOT NULL DEFAULT 0,
  avg_drift_pct      numeric,
  avg_composite_score numeric,
  consistency        text NOT NULL DEFAULT 'new' CHECK (consistency IN ('consistent', 'variable', 'new')),
  last_updated       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.strategy_performance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategy_performance_summary_select_all
  ON public.strategy_performance_summary FOR SELECT
  USING (true);

GRANT SELECT ON public.strategy_performance_summary TO anon, authenticated;
GRANT ALL ON public.strategy_performance_summary TO service_role;

COMMENT ON TABLE public.strategy_performance_summary IS
  'Materialized aggregate performance metrics per strategy. Updated periodically via cron.';
