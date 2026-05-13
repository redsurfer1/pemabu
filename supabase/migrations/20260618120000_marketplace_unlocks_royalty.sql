-- Marketplace import unlock ($9.99) + creator royalty ledger (cents-based).

CREATE TABLE IF NOT EXISTS public.creator_stats (
  creator_user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  accrued_royalties_cents bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.creator_stats IS
  'Cumulative creator earnings from marketplace unlock royalties (integer cents only).';

CREATE TABLE IF NOT EXISTS public.marketplace_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  blueprint_id uuid NOT NULL REFERENCES public.marketplace_strategies (id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL,
  price_paid_cents integer NOT NULL CHECK (price_paid_cents > 0),
  creator_royalty_pct numeric(8, 6) NOT NULL,
  creator_payout_cents integer NOT NULL CHECK (creator_payout_cents >= 0),
  platform_fee_cents integer NOT NULL CHECK (platform_fee_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, blueprint_id),
  UNIQUE (stripe_session_id)
);

CREATE INDEX IF NOT EXISTS marketplace_unlocks_user_idx ON public.marketplace_unlocks (user_id, created_at DESC);

COMMENT ON TABLE public.marketplace_unlocks IS
  'One-time Stripe unlock per buyer + published strategy; amounts in integer cents.';

CREATE TABLE IF NOT EXISTS public.sovereign_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sovereign_sync_log IS
  'Append-only local-vault replication / sovereign sync diagnostics (service role writes).';

ALTER TABLE public.creator_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sovereign_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_stats_select_self"
  ON public.creator_stats FOR SELECT TO authenticated
  USING (creator_user_id = (SELECT auth.uid()));

CREATE POLICY "marketplace_unlocks_select_own"
  ON public.marketplace_unlocks FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Inserts from Stripe webhook use service_role (bypass RLS).

GRANT SELECT ON public.creator_stats TO authenticated;
GRANT SELECT ON public.marketplace_unlocks TO authenticated;

GRANT ALL ON public.creator_stats TO service_role;
GRANT ALL ON public.marketplace_unlocks TO service_role;
GRANT ALL ON public.sovereign_sync_log TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemabu') THEN
    GRANT SELECT, INSERT, UPDATE ON public.creator_stats TO pemabu;
    GRANT SELECT, INSERT ON public.marketplace_unlocks TO pemabu;
    GRANT SELECT, INSERT ON public.sovereign_sync_log TO pemabu;
  END IF;
END $$;
