-- 20260710000002_creator_payouts.sql
-- Creator payout requests: tracks payout lifecycle from request to completion.

CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount_cents       integer NOT NULL CHECK (amount_cents > 0),
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_transfer_id text,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  notes              text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_creator_payouts_creator_status
  ON public.creator_payouts (creator_user_id, status);

ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_payouts_select_own
  ON public.creator_payouts FOR SELECT
  TO authenticated
  USING (creator_user_id = auth.uid());

GRANT SELECT ON public.creator_payouts TO authenticated;
GRANT ALL ON public.creator_payouts TO service_role;

COMMENT ON TABLE public.creator_payouts IS
  'Creator payout requests in cents. Status lifecycle: pending -> processing -> completed | failed.';
