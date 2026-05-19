-- 20260705000001_cloud_vault_rpcs.sql
-- Cloud-hosted vault: Supabase-side RPCs for execution operations
-- that require service_role bypass (used by cloud-vault-plane.ts).
-- When USE_LOCAL_VAULT is false, the app uses these RPCs instead of
-- the direct Postgres vault pool.

-- ── User-level vault preference ───────────────────────────────────────────
-- Column already exists implicitly: USE_LOCAL_VAULT env var controls routing.
-- No schema change needed — routing is app-level.

-- ── Exchange credentials: read via service_role ───────────────────────────

CREATE OR REPLACE FUNCTION cloud_fetch_exchange_credentials(
  p_user_id uuid,
  p_exchange_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'encrypted_api_key', ec.encrypted_api_key,
    'encrypted_secret', ec.encrypted_secret,
    'iv', ec.iv,
    'auth_tag', ec.auth_tag,
    'secret_iv', ec.secret_iv,
    'secret_auth_tag', ec.secret_auth_tag
  ) INTO v_result
  FROM exchange_credentials ec
  WHERE ec.user_id = p_user_id AND ec.exchange_name = p_exchange_name;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_fetch_exchange_credentials TO service_role;

-- ── Exchange credentials: upsert ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_upsert_exchange_credentials(
  p_user_id uuid,
  p_exchange_name text,
  p_encrypted_api_key text,
  p_iv text,
  p_auth_tag text,
  p_encrypted_secret text,
  p_secret_iv text,
  p_secret_auth_tag text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO exchange_credentials (
    user_id, exchange_name, encrypted_api_key, encrypted_secret,
    iv, auth_tag, secret_iv, secret_auth_tag, updated_at
  ) VALUES (
    p_user_id, p_exchange_name, p_encrypted_api_key, p_encrypted_secret,
    p_iv, p_auth_tag, p_secret_iv, p_secret_auth_tag, now()
  )
  ON CONFLICT (user_id, exchange_name) DO UPDATE SET
    encrypted_api_key = EXCLUDED.encrypted_api_key,
    encrypted_secret = EXCLUDED.encrypted_secret,
    iv = EXCLUDED.iv,
    auth_tag = EXCLUDED.auth_tag,
    secret_iv = EXCLUDED.secret_iv,
    secret_auth_tag = EXCLUDED.secret_auth_tag,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_upsert_exchange_credentials TO service_role;

-- ── Exchange credentials: delete ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_delete_exchange_credentials(
  p_user_id uuid,
  p_exchange_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM exchange_credentials
  WHERE user_id = p_user_id AND exchange_name = p_exchange_name;
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_delete_exchange_credentials TO service_role;

-- ── Execution control: get or create ──────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_ensure_execution_control(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row execution_control%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM execution_control WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO execution_control (user_id, kill_switch_enabled, circuit_locked, consecutive_api_failures, last_error_codes)
    VALUES (p_user_id, true, false, 0, '{}')
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'kill_switch_enabled', v_row.kill_switch_enabled,
    'circuit_locked', v_row.circuit_locked,
    'consecutive_api_failures', v_row.consecutive_api_failures,
    'last_error_codes', COALESCE(v_row.last_error_codes, '{}'),
    'max_trade_usd', v_row.max_trade_usd,
    'max_trade_pct_portfolio', v_row.max_trade_pct_portfolio,
    'daily_volume_limit_usd', v_row.daily_volume_limit_usd
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_ensure_execution_control TO service_role;

-- ── Execution control: update ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_update_execution_control(
  p_user_id uuid,
  p_fields jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE execution_control
  SET
    kill_switch_enabled = COALESCE((p_fields->>'kill_switch_enabled')::boolean, kill_switch_enabled),
    circuit_locked = COALESCE((p_fields->>'circuit_locked')::boolean, circuit_locked),
    consecutive_api_failures = COALESCE((p_fields->>'consecutive_api_failures')::int, consecutive_api_failures),
    last_error_codes = COALESCE((p_fields->>'last_error_codes')::text[], last_error_codes),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_update_execution_control TO service_role;

-- ── Portfolio autonomous execution toggle ─────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_set_autonomous_execution(
  p_portfolio_id uuid,
  p_user_id uuid,
  p_enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE portfolios
  SET autonomous_execution_enabled = p_enabled, updated_at = now()
  WHERE id = p_portfolio_id AND user_id = p_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_set_autonomous_execution TO service_role;

-- ── Trade proposal operations ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_fetch_trade_proposal(
  p_user_id uuid,
  p_proposal_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
BEGIN
  SELECT row_to_json(tp)::jsonb INTO v_row
  FROM trade_proposals tp
  WHERE tp.id = p_proposal_id AND tp.user_id = p_user_id;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_fetch_trade_proposal TO service_role;

CREATE OR REPLACE FUNCTION cloud_update_trade_proposal_status(
  p_proposal_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trade_proposals
  SET status = p_status, updated_at = now()
  WHERE id = p_proposal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_update_trade_proposal_status TO service_role;

CREATE OR REPLACE FUNCTION cloud_list_pending_trade_proposals(
  p_user_id uuid
)
RETURNS jsonb[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb[];
BEGIN
  SELECT array_agg(row_to_json(tp)::jsonb) INTO v_rows
  FROM (
    SELECT id::text, portfolio_id::text, sleeve_id::text, holding_id::text,
           ticker, quantity::text
    FROM trade_proposals
    WHERE user_id = p_user_id AND status = 'PENDING'
    ORDER BY created_at ASC
  ) tp;

  RETURN COALESCE(v_rows, '{}');
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_list_pending_trade_proposals TO service_role;

CREATE OR REPLACE FUNCTION cloud_list_trade_proposals(
  p_user_id uuid,
  p_limit int DEFAULT 50
)
RETURNS jsonb[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb[];
BEGIN
  SELECT array_agg(row_to_json(tp)::jsonb) INTO v_rows
  FROM (
    SELECT id::text, portfolio_id::text, sleeve_id::text, holding_id::text,
           ticker, action, quantity::text, status, exchange_name,
           drift_pct::text, created_at::text, updated_at::text
    FROM trade_proposals
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT p_limit
  ) tp;

  RETURN COALESCE(v_rows, '{}');
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_list_trade_proposals TO service_role;

-- ── Daily execution log insert ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_insert_daily_execution_log(
  p_user_id uuid,
  p_notional_usd numeric,
  p_proposal_id uuid,
  p_exchange_name text,
  p_result text,
  p_error_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_execution_logs (user_id, notional_usd, proposal_id, exchange_name, result, error_code)
  VALUES (p_user_id, p_notional_usd, p_proposal_id, p_exchange_name, p_result, p_error_code);
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_insert_daily_execution_log TO service_role;

-- ── Portfolio NAV (via holdings) ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_portfolio_nav_usd(
  p_portfolio_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(h.quantity * h.current_price), 0)
  INTO v_total
  FROM holdings h
  WHERE h.portfolio_id = p_portfolio_id;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_portfolio_nav_usd TO service_role;

-- ── Rolling 24h notional ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_rolling_24h_notional(
  p_user_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(notional_usd)
     FROM daily_execution_logs
     WHERE user_id = p_user_id AND created_at >= now() - interval '24 hours'),
    0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_rolling_24h_notional TO service_role;

-- ── Sleeve holding qty/price ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_fetch_sleeve_holding_qty_price(
  p_holding_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object('qty', qty::text, 'price_seed', price_seed::text)
  INTO v_result
  FROM sleeve_holdings
  WHERE id = p_holding_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_fetch_sleeve_holding_qty_price TO service_role;

-- ── Holding audit insert ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cloud_insert_holding_audit(
  p_user_id uuid,
  p_portfolio_id uuid,
  p_sleeve_id uuid,
  p_holding_id uuid,
  p_event_type text,
  p_ticker text,
  p_quantity_before numeric,
  p_quantity_after numeric,
  p_cost_basis_before numeric,
  p_cost_basis_after numeric,
  p_notes jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO holding_audit_log (
    user_id, portfolio_id, sleeve_id, holding_id, event_type, ticker,
    quantity_before, quantity_after, cost_basis_before, cost_basis_after, notes
  ) VALUES (
    p_user_id, p_portfolio_id, p_sleeve_id, p_holding_id, p_event_type, p_ticker,
    p_quantity_before, p_quantity_after, p_cost_basis_before, p_cost_basis_after, p_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cloud_insert_holding_audit TO service_role;
