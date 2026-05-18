-- Autonomous execution bridge: encrypted exchange keys, trade proposals, daily limits,
-- kill switch / circuit breaker, portfolio flag for watcher-generated proposals.

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS autonomous_execution_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.portfolios.autonomous_execution_enabled IS
  'When true, Watcher may enqueue trade_proposals for this portfolio (Autonomous tier; set via app after tier check).';

-- ── Exchange credential vault (AES-256-GCM ciphertext + iv + auth tag, base64) ──
CREATE TABLE IF NOT EXISTS public.exchange_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exchange_name text NOT NULL
    CHECK (exchange_name IN ('alpaca', 'kraken', 'coinbase_advanced')),
  encrypted_api_key text NOT NULL,
  encrypted_secret text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exchange_name)
);

CREATE INDEX IF NOT EXISTS exchange_credentials_user_idx ON public.exchange_credentials (user_id);

-- ── Trade proposal queue ──
CREATE TABLE IF NOT EXISTS public.trade_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portfolio_id uuid NOT NULL REFERENCES public.portfolios (id) ON DELETE CASCADE,
  sleeve_id uuid NOT NULL REFERENCES public.sleeves (id) ON DELETE CASCADE,
  holding_id uuid,
  ticker text NOT NULL,
  action text NOT NULL CHECK (action IN ('BUY', 'SELL')),
  quantity numeric(24, 8) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'EXECUTED', 'REJECTED')),
  drift_pct numeric(14, 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_proposals_user_status_idx
  ON public.trade_proposals (user_id, status, created_at DESC);

-- ── Daily execution volume (guardrail 2) ──
CREATE TABLE IF NOT EXISTS public.daily_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trade_date date NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'utc'),
  notional_usd numeric(18, 4) NOT NULL,
  proposal_id uuid REFERENCES public.trade_proposals (id) ON DELETE SET NULL,
  exchange_name text,
  result text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_execution_logs_user_date_idx
  ON public.daily_execution_logs (user_id, trade_date);

-- ── Per-user execution control (kill switch, circuit breaker, guardrail limits) ──
CREATE TABLE IF NOT EXISTS public.execution_control (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  kill_switch_enabled boolean NOT NULL DEFAULT true,
  circuit_locked boolean NOT NULL DEFAULT false,
  consecutive_api_failures int NOT NULL DEFAULT 0,
  last_error_codes text[] NOT NULL DEFAULT '{}',
  max_trade_usd numeric(18, 2),
  max_trade_pct_portfolio numeric(12, 8),
  daily_volume_limit_usd numeric(18, 2),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.holding_audit_log
  DROP CONSTRAINT IF EXISTS holding_audit_log_event_type_check;

ALTER TABLE public.holding_audit_log
  ADD CONSTRAINT holding_audit_log_event_type_check
  CHECK (event_type IN (
    'ADD',
    'PARTIAL_SELL',
    'FULL_EXIT',
    'SLEEVE_REMOVED',
    'DRIFT_AFTER_REMOVAL',
    'TRADE_PROPOSAL_CREATED',
    'TRADE_PROPOSAL_APPROVED',
    'TRADE_PROPOSAL_REJECTED',
    'TRADE_EXECUTION_ATTEMPT',
    'TRADE_EXECUTION_SUCCESS',
    'TRADE_EXECUTION_FAILURE'
  ));

-- SECURITY DEFINER: Watcher (no JWT) inserts proposals + audit when portfolio is opted-in.
CREATE OR REPLACE FUNCTION public.watcher_create_trade_proposal_and_audit(
  p_user_id uuid,
  p_portfolio_id uuid,
  p_sleeve_id uuid,
  p_holding_id uuid,
  p_ticker text,
  p_action text,
  p_quantity numeric,
  p_drift_pct numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.portfolios p
    WHERE p.id = p_portfolio_id
      AND p.user_id = p_user_id
      AND p.autonomous_execution_enabled = true
  ) THEN
    RETURN NULL;
  END IF;

  IF p_action NOT IN ('BUY', 'SELL') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  INSERT INTO public.trade_proposals (
    user_id, portfolio_id, sleeve_id, holding_id, ticker, action, quantity, status, drift_pct
  ) VALUES (
    p_user_id, p_portfolio_id, p_sleeve_id, p_holding_id, upper(trim(p_ticker)), p_action, p_quantity, 'PENDING', p_drift_pct
  )
  RETURNING id INTO v_id;

  INSERT INTO public.holding_audit_log (
    user_id, portfolio_id, sleeve_id, holding_id, event_type, ticker,
    quantity_before, quantity_after, cost_basis_before, cost_basis_after, notes
  ) VALUES (
    p_user_id, p_portfolio_id, p_sleeve_id, p_holding_id, 'TRADE_PROPOSAL_CREATED', upper(trim(p_ticker)),
    NULL, p_quantity::numeric, NULL, NULL, jsonb_build_object('proposal_id', v_id, 'action', p_action, 'drift_pct', p_drift_pct)
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.watcher_create_trade_proposal_and_audit(uuid, uuid, uuid, uuid, text, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.watcher_create_trade_proposal_and_audit(uuid, uuid, uuid, uuid, text, text, numeric, numeric) TO service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT EXECUTE ON FUNCTION public.watcher_create_trade_proposal_and_audit(uuid, uuid, uuid, uuid, text, text, numeric, numeric) TO pemabu;
  END IF;
END $$;

-- SECURITY DEFINER: app pool / service inserts execution audit rows with ownership check.
CREATE OR REPLACE FUNCTION public.insert_holding_audit_execution(
  p_user_id uuid,
  p_portfolio_id uuid,
  p_sleeve_id uuid,
  p_holding_id uuid,
  p_event_type text,
  p_ticker text,
  p_quantity_before numeric,
  p_quantity_after numeric,
  p_notes jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portfolios WHERE id = p_portfolio_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'forbidden audit insert';
  END IF;

  INSERT INTO public.holding_audit_log (
    user_id, portfolio_id, sleeve_id, holding_id, event_type, ticker,
    quantity_before, quantity_after, cost_basis_before, cost_basis_after, notes
  ) VALUES (
    p_user_id, p_portfolio_id, p_sleeve_id, p_holding_id, p_event_type, coalesce(nullif(trim(p_ticker), ''), '_EXEC_'),
    p_quantity_before, p_quantity_after, NULL, NULL, COALESCE(p_notes, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.insert_holding_audit_execution(uuid, uuid, uuid, uuid, text, text, numeric, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_holding_audit_execution(uuid, uuid, uuid, uuid, text, text, numeric, numeric, jsonb) TO service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT EXECUTE ON FUNCTION public.insert_holding_audit_execution(uuid, uuid, uuid, uuid, text, text, numeric, numeric, jsonb) TO pemabu;
  END IF;
END $$;

ALTER TABLE public.exchange_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_control ENABLE ROW LEVEL SECURITY;

-- RLS: owner-scoped credentials & proposals
DO $$ BEGIN
  CREATE POLICY "exchange_credentials_select_own"
    ON public.exchange_credentials FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "exchange_credentials_insert_own"
    ON public.exchange_credentials FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "exchange_credentials_update_own"
    ON public.exchange_credentials FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "exchange_credentials_delete_own"
    ON public.exchange_credentials FOR DELETE TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "trade_proposals_select_own"
    ON public.trade_proposals FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "trade_proposals_update_own"
    ON public.trade_proposals FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "daily_execution_logs_select_own"
    ON public.daily_execution_logs FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "daily_execution_logs_insert_own"
    ON public.daily_execution_logs FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "execution_control_select_own"
    ON public.execution_control FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "execution_control_insert_own"
    ON public.execution_control FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "execution_control_update_own"
    ON public.execution_control FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.exchange_credentials TO authenticated;
GRANT SELECT, UPDATE ON public.trade_proposals TO authenticated;
GRANT SELECT, INSERT ON public.daily_execution_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.execution_control TO authenticated;
