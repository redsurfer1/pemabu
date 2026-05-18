-- Founding Publisher Program: first 50 publishers get 80/20 royalty and featured sort.

ALTER TABLE public.marketplace_strategies
  ADD COLUMN IF NOT EXISTS is_founding_publisher BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_marketplace_strategies_founding_publisher
  ON public.marketplace_strategies (is_founding_publisher DESC)
  WHERE is_founding_publisher = true;

CREATE OR REPLACE VIEW public.founding_publisher_stats AS
SELECT
  COUNT(*)::bigint AS total_founding_publishers,
  50::bigint AS program_cap,
  GREATEST(0, 50 - COUNT(*)::integer)::bigint AS slots_remaining,
  (COUNT(*) >= 50) AS is_full
FROM public.marketplace_strategies
WHERE is_founding_publisher = true;

COMMENT ON COLUMN public.marketplace_strategies.is_founding_publisher IS
  'First 50 publishers: 80/20 royalty split and featured leaderboard placement.';

GRANT SELECT ON public.founding_publisher_stats TO anon, authenticated, service_role;
