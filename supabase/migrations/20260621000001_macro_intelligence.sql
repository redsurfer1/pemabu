-- ─────────────────────────────────────────────────────────────────────────────
-- MACRO INTELLIGENCE
-- Stores regime classification history and cached indicator snapshots.
-- ─────────────────────────────────────────────────────────────────────────────

create type public.macro_regime as enum (
  'risk_on',
  'risk_off',
  'stagflation',
  'deflation'
);

create table if not exists public.macro_regime_history (
  id              uuid         primary key default gen_random_uuid(),
  user_id         uuid         not null references auth.users(id) on delete cascade,
  regime          public.macro_regime not null,
  confidence_pct  numeric(5,2) not null check (confidence_pct between 0 and 100),
  indicator_vix         numeric(8,4),
  indicator_yield_10y   numeric(8,4),
  indicator_yield_2y    numeric(8,4),
  indicator_dxy         numeric(8,4),
  indicator_gold_pct    numeric(8,4),
  indicator_btc_pct     numeric(8,4),
  indicator_sp500_pct   numeric(8,4),
  suggested_weights     jsonb,
  classified_at         timestamptz not null default now(),
  notes                 text
);

create index if not exists idx_macro_regime_history_user_date
  on public.macro_regime_history (user_id, classified_at desc);

create table if not exists public.macro_correlation_cache (
  id              uuid    primary key default gen_random_uuid(),
  asset_pair      text    not null,
  correlation_30d numeric(8,6),
  correlation_90d numeric(8,6),
  computed_at     timestamptz not null default now(),
  unique(asset_pair)
);

alter table public.macro_regime_history   enable row level security;
alter table public.macro_correlation_cache enable row level security;

do $$ begin
  create policy "users_own_macro_history"
    on public.macro_regime_history
    for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_read_correlation_cache"
    on public.macro_correlation_cache for select
    using (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;

grant all    on public.macro_regime_history    to service_role;
grant select on public.macro_regime_history    to authenticated;
grant all    on public.macro_correlation_cache to service_role;
grant select on public.macro_correlation_cache to authenticated;
