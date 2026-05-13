-- Execution safety: portfolio protocol lock + append-only execution outcomes (3-strike).

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS system_status text NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.portfolios
  DROP CONSTRAINT IF EXISTS portfolios_system_status_check;

ALTER TABLE public.portfolios
  ADD CONSTRAINT portfolios_system_status_check
  CHECK (system_status IN ('ACTIVE', 'LOCKED'));

COMMENT ON COLUMN public.portfolios.system_status IS
  'ACTIVE: normal. LOCKED: execution disabled after 3 consecutive execution_errors failures; reset via operator action.';

CREATE TABLE IF NOT EXISTS public.execution_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.trade_proposals (id) ON DELETE SET NULL,
  succeeded boolean NOT NULL DEFAULT false,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS execution_errors_portfolio_created_idx
  ON public.execution_errors (portfolio_id, created_at DESC);

CREATE INDEX IF NOT EXISTS execution_errors_user_created_idx
  ON public.execution_errors (user_id, created_at DESC);

COMMENT ON TABLE public.execution_errors IS
  'Append-only execution outcomes per portfolio; last 3 rows used for fail-fast LOCKED.';

ALTER TABLE public.execution_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "execution_errors_select_own"
  ON public.execution_errors FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "execution_errors_insert_own"
  ON public.execution_errors FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.execution_errors TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT SELECT, INSERT ON public.execution_errors TO pemabu;
    GRANT UPDATE ON public.portfolios TO pemabu;
  END IF;
END $$;
