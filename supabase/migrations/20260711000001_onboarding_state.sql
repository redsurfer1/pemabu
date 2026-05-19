-- ─────────────────────────────────────────────────────────────────────────────
-- ONBOARDING STATE
-- Tracks whether a user has completed the first-run wizard.
-- Stored in user_profiles to persist across devices and sessions.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.user_profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_step_reached integer not null default 0;

comment on column public.user_profiles.onboarding_completed is
  'True when the user has completed or explicitly dismissed the onboarding wizard.';

comment on column public.user_profiles.onboarding_step_reached is
  'Highest wizard step the user reached (1=portfolio, 2=holding, 3=engine). '
  'Used to resume a partially-completed wizard.';
