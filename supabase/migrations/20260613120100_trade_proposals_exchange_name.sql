-- Add venue to proposals and extend watcher RPC (idempotent follow-up to execution bridge).

ALTER TABLE public.trade_proposals
  ADD COLUMN IF NOT EXISTS exchange_name text NOT NULL DEFAULT 'alpaca';

ALTER TABLE public.trade_proposals
  DROP CONSTRAINT IF EXISTS trade_proposals_exchange_name_check;

ALTER TABLE public.trade_proposals
  ADD CONSTRAINT trade_proposals_exchange_name_check
  CHECK (exchange_name IN ('alpaca', 'kraken', 'coinbase_advanced'));

DROP FUNCTION IF EXISTS public.watcher_create_trade_proposal_and_audit(uuid, uuid, uuid, uuid, text, text, numeric, numeric);

CREATE OR REPLACE FUNCTION public.watcher_create_trade_proposal_and_audit(
  p_user_id uuid,
  p_portfolio_id uuid,
  p_sleeve_id uuid,
  p_holding_id uuid,
  p_ticker text,
  p_exchange_name text,
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

  IF p_exchange_name NOT IN ('alpaca', 'kraken', 'coinbase_advanced') THEN
    RAISE EXCEPTION 'invalid exchange';
  END IF;

  INSERT INTO public.trade_proposals (
    user_id, portfolio_id, sleeve_id, holding_id, ticker, exchange_name, action, quantity, status, drift_pct
  ) VALUES (
    p_user_id, p_portfolio_id, p_sleeve_id, p_holding_id, upper(trim(p_ticker)), p_exchange_name, p_action, p_quantity, 'PENDING', p_drift_pct
  )
  RETURNING id INTO v_id;

  INSERT INTO public.holding_audit_log (
    user_id, portfolio_id, sleeve_id, holding_id, event_type, ticker,
    quantity_before, quantity_after, cost_basis_before, cost_basis_after, notes
  ) VALUES (
    p_user_id, p_portfolio_id, p_sleeve_id, p_holding_id, 'TRADE_PROPOSAL_CREATED', upper(trim(p_ticker)),
    NULL, p_quantity::numeric, NULL, NULL, jsonb_build_object(
      'proposal_id', v_id, 'action', p_action, 'drift_pct', p_drift_pct, 'exchange_name', p_exchange_name
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.watcher_create_trade_proposal_and_audit(uuid, uuid, uuid, uuid, text, text, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.watcher_create_trade_proposal_and_audit(uuid, uuid, uuid, uuid, text, text, text, numeric, numeric) TO service_role;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT EXECUTE ON FUNCTION public.watcher_create_trade_proposal_and_audit(uuid, uuid, uuid, uuid, text, text, text, numeric, numeric) TO pemabu;
  END IF;
END $$;
