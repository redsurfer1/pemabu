-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL EXISTING marketplace_unlocks → marketplace_import_ledger
--
-- OPERATOR INSTRUCTIONS:
-- 1. Apply migration 20260620000001_import_token_spend_rpc.sql first
-- 2. Apply this migration on the production database
-- 3. Verify backfill row counts:
--      SELECT COUNT(*) FROM marketplace_import_ledger
--      WHERE direction = 'credit' AND is_complimentary = true;
--    Row count should equal: SELECT COUNT(*) FROM marketplace_unlocks;
-- 4. Only then set MARKETPLACE_USE_IMPORT_LEDGER=true in Vercel env
-- 5. Redeploy
-- 6. Monitor Stripe webhook logs for 5 minutes post-deploy
--
-- SAFETY:
-- - Safe to run multiple times (ON CONFLICT DO NOTHING + WHERE NOT EXISTS guard)
-- - Existing buyers receive complimentary credit rows — they are not re-charged
-- - Each marketplace_unlock row becomes one credit token, preserving access parity
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.marketplace_import_ledger (
  user_id,
  strategy_id,
  service_key,
  direction,
  tokens_consumed,
  price_per_token,
  total_charged_usd,
  amount_usd_cents,
  is_complimentary,
  stripe_session_id,
  imported_at,
  notes
)
SELECT
  mu.user_id,
  mu.blueprint_id,                           -- marketplace_strategies.id
  'marketplace_import_token',
  'credit',
  1,
  (mu.price_paid_cents::NUMERIC / 100),      -- e.g. 4.99
  (mu.price_paid_cents::NUMERIC / 100),
  mu.price_paid_cents,                       -- integer cents as-is
  TRUE,                                      -- complimentary — already paid via unlock
  mu.stripe_session_id,
  mu.created_at,
  'Backfilled from marketplace_unlocks — existing buyer credit grant'
FROM public.marketplace_unlocks mu
WHERE NOT EXISTS (
  SELECT 1
  FROM public.marketplace_import_ledger mil
  WHERE mil.stripe_session_id = mu.stripe_session_id
    AND mil.user_id             = mu.user_id
    AND mil.direction           = 'credit'
)
ON CONFLICT DO NOTHING;


-- ── Verification block ────────────────────────────────────────────────────────

DO $$
DECLARE
  v_unlock_count  BIGINT;
  v_credit_count  BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_unlock_count FROM public.marketplace_unlocks;
  SELECT COUNT(*) INTO v_credit_count
    FROM public.marketplace_import_ledger
    WHERE direction = 'credit' AND is_complimentary = TRUE;

  RAISE NOTICE 'marketplace_unlocks rows:                  %', v_unlock_count;
  RAISE NOTICE 'marketplace_import_ledger complimentary credits: %', v_credit_count;

  IF v_credit_count < v_unlock_count THEN
    RAISE WARNING
      'Backfill may be incomplete: % unlocks but only % complimentary credit rows. '
      'This is OK if some sessions were already credited by the webhook. '
      'Verify with: SELECT stripe_session_id FROM marketplace_unlocks '
      'EXCEPT SELECT stripe_session_id FROM marketplace_import_ledger '
      'WHERE direction = ''credit'';',
      v_unlock_count, v_credit_count;
  ELSE
    RAISE NOTICE 'BACKFILL COMPLETE: all existing buyers have credit rows.';
  END IF;
END $$;
