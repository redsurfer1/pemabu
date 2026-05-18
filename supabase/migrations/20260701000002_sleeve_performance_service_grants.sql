-- Cron snapshot uses service_role (supabaseAdmin). Ensure write access to performance log
-- and read access to marketplace strategies (table may post-date blanket service_role grants).

GRANT SELECT ON public.marketplace_strategies TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.sleeve_performance_log TO service_role;
