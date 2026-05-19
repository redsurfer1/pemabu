-- RLS audit fix: portfolio_drift_alerts was completely missing RLS.
-- sovereign_sync_log had RLS enabled but no authenticated policy (implicit deny).

-- ── 1. portfolio_drift_alerts: enable RLS + add owner-select policy ────────────

ALTER TABLE IF EXISTS public.portfolio_drift_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "portfolio_drift_alerts_select_owner"
    ON public.portfolio_drift_alerts FOR SELECT
    TO authenticated
    USING (
      portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "portfolio_drift_alerts_insert_service"
    ON public.portfolio_drift_alerts FOR INSERT
    TO service_role
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.portfolio_drift_alerts TO authenticated;
GRANT ALL ON public.portfolio_drift_alerts TO service_role;

-- ── 2. sovereign_sync_log: explicit DENY ALL for defense-in-depth ──────────────

DO $$ BEGIN
  CREATE POLICY "sovereign_sync_log_deny_authenticated"
    ON public.sovereign_sync_log
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
