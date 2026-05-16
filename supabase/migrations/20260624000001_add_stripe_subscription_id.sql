-- Add Stripe identifiers to user_subscriptions.
-- stripe_subscription_id: links annual Stripe subscriptions for renewal + cancellation webhooks.
-- stripe_session_id:      idempotency key — prevents double-fulfilment on duplicate webhook delivery.

alter table public.user_subscriptions
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_session_id       text unique;

create index if not exists idx_user_subscriptions_stripe_sub_id
  on public.user_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.user_subscriptions.stripe_subscription_id is
  'Stripe Subscription ID (sub_…). Set for annual services; null for one-time purchases.';

comment on column public.user_subscriptions.stripe_session_id is
  'Stripe Checkout Session ID (cs_…). Idempotency key for checkout.session.completed webhook.';
