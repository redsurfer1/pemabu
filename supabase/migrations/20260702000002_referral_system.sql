-- Referral system for import token acquisition
-- Referrer and referee both receive 1 import token credit on referee's first token purchase.

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  code                TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_referrals     INTEGER NOT NULL DEFAULT 0,
  total_credits_earned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.referral_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  referee_user_id   UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL,
  referrer_credits  INTEGER NOT NULL DEFAULT 1,
  referee_credits   INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_events_unique_pair UNIQUE (referrer_user_id, referee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes (code);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON public.referral_events (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referee ON public.referral_events (referee_user_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_codes_owner_read"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "referral_events_participant_read"
  ON public.referral_events FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

COMMENT ON TABLE public.referral_codes IS
  'One referral code per user. Share to earn 1 import token per successful referral.';
COMMENT ON TABLE public.referral_events IS
  'Records each completed referral. Idempotent: one reward per referrer-referee pair.';
