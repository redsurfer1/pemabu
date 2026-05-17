-- ─────────────────────────────────────────────────────────────────────────────
-- IMPORT TOKEN LEDGER SCHEMA EXTENSION + ATOMIC SPEND RPC
--
-- Extends marketplace_import_ledger (created in 20260619000002) with:
--   direction       — 'credit' | 'debit' model
--   stripe_session_id — dedup key for Stripe credit rows
--   idempotency_key   — dedup key for debit rows (prevents double-spend)
--   amount_usd_cents  — integer cents; set on credit rows
--
-- Creates Postgres RPCs:
--   spend_import_token()       — atomic spend with advisory lock + balance check
--   get_import_token_balance() — balance query helper
--
-- Safe to run on a fresh install or after 20260619000002.
-- All ALTER TABLE statements use ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Schema extensions ─────────────────────────────────────────────────────────

-- direction: 'credit' (purchased/granted) | 'debit' (consumed on import)
-- Existing rows (all import events) default to 'debit'.
ALTER TABLE public.marketplace_import_ledger
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'debit'
    CHECK (direction IN ('credit', 'debit'));

-- stripe_session_id: present on credit rows from Stripe webhook
ALTER TABLE public.marketplace_import_ledger
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- idempotency_key: present on debit rows; prevents double-spend on retries
ALTER TABLE public.marketplace_import_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- amount_usd_cents: integer cents for credit rows (mirrors price_per_token * 100)
ALTER TABLE public.marketplace_import_ledger
  ADD COLUMN IF NOT EXISTS amount_usd_cents INTEGER;

-- Unique constraint on stripe_session_id for credit rows (webhook idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_ledger_stripe_session_credit
  ON public.marketplace_import_ledger (stripe_session_id)
  WHERE direction = 'credit' AND stripe_session_id IS NOT NULL;

-- Unique constraint on idempotency_key for debit rows (spend idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_ledger_idempotency_debit
  ON public.marketplace_import_ledger (idempotency_key)
  WHERE direction = 'debit' AND idempotency_key IS NOT NULL;


-- ── Balance query function ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_import_token_balance(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(
      CASE WHEN direction = 'credit'
           THEN tokens_consumed
           ELSE -tokens_consumed
      END
    ),
    0
  )::INTEGER
  FROM public.marketplace_import_ledger
  WHERE user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.get_import_token_balance IS
  'Returns the net import token balance for a user: SUM(credits) - SUM(debits).';


-- ── Atomic spend RPC ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.spend_import_token(
  p_user_id         UUID,
  p_strategy_id     UUID,        -- nullable; NULL for non-catalog imports
  p_strategy_slug   TEXT,        -- audit label
  p_portfolio_id    UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance     INTEGER;
  v_ledger_id   UUID;
  v_new_balance INTEGER;
BEGIN
  -- Per-user advisory lock: serializes concurrent import requests for the same user.
  -- pg_advisory_xact_lock is automatically released at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::TEXT));

  -- Recalculate balance inside the lock to prevent TOCTOU race.
  SELECT COALESCE(
    SUM(CASE WHEN direction = 'credit' THEN tokens_consumed ELSE -tokens_consumed END),
    0
  )::INTEGER
  INTO v_balance
  FROM public.marketplace_import_ledger
  WHERE user_id = p_user_id;

  -- Reject if insufficient balance.
  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_TOKENS: balance is %', v_balance
      USING ERRCODE = 'P0001';
  END IF;

  -- Insert debit row.
  -- The unique index on (idempotency_key) WHERE direction='debit' prevents
  -- double-spend if the same idempotency key is submitted twice.
  INSERT INTO public.marketplace_import_ledger (
    user_id,
    strategy_id,
    service_key,
    direction,
    tokens_consumed,
    price_per_token,
    total_charged_usd,
    is_complimentary,
    idempotency_key,
    notes
  ) VALUES (
    p_user_id,
    p_strategy_id,
    'marketplace_import_token',
    'debit',
    1,
    4.99,
    4.99,
    FALSE,
    p_idempotency_key,
    p_strategy_slug
  )
  RETURNING id INTO v_ledger_id;

  v_new_balance := v_balance - 1;

  RETURN jsonb_build_object(
    'success',      TRUE,
    'newBalance',   v_new_balance,
    'ledgerRowId',  v_ledger_id
  );
END;
$$;

COMMENT ON FUNCTION public.spend_import_token IS
  'Atomically spends one import token. Uses pg_advisory_xact_lock to prevent '
  'TOCTOU races. Raises P0001 (INSUFFICIENT_TOKENS) if balance is zero. '
  'Duplicate idempotency_key raises 23505 (handled in application layer).';


-- ── Grants ────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.get_import_token_balance TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_import_token TO service_role;

-- Existing pemabu vault role (Docker deployment)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT EXECUTE ON FUNCTION public.get_import_token_balance TO pemabu;
    GRANT EXECUTE ON FUNCTION public.spend_import_token TO pemabu;
  END IF;
END $$;
