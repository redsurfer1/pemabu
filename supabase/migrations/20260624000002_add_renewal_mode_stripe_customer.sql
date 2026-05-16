-- renewal_mode: distinguishes Stripe Subscription (auto) from one-time annual payment (manual)
-- and perpetual licenses (one_time). Drives ends_at logic and Customer Portal access.

alter table public.user_subscriptions
  add column if not exists renewal_mode text
    check (renewal_mode in ('auto', 'manual', 'one_time'));

-- Backfill existing Stripe-fulfilled rows based on available signals.
-- Rows with a stripe_subscription_id were created via subscription mode → auto.
-- Rows with ends_at but no subscription ID → manual payment.
-- Rows with no ends_at → perpetual one-time purchase.
update public.user_subscriptions
set renewal_mode = case
  when stripe_subscription_id is not null then 'auto'
  when ends_at is null                    then 'one_time'
  else                                         'manual'
end
where renewal_mode is null;

comment on column public.user_subscriptions.renewal_mode is
  'auto = Stripe recurring subscription; manual = one-time annual payment (user re-subscribes yearly); '
  'one_time = perpetual license (no expiry).';

-- ── Stripe Customer ID on user_profiles ──────────────────────────────────────
-- One Stripe Customer per Pemabu user. Created on first auto-renewal purchase.
-- Required for Stripe Customer Portal (cancel, update payment method, invoices).

alter table public.user_profiles
  add column if not exists stripe_customer_id text unique;

create index if not exists idx_user_profiles_stripe_customer_id
  on public.user_profiles (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.user_profiles.stripe_customer_id is
  'Stripe Customer ID (cus_…). Set when user first purchases an auto-renewal subscription. '
  'Used for Customer Portal session creation.';
