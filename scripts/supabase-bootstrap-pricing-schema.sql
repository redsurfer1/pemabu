-- =============================================================================
-- STEP 1 — Run this FIRST in Supabase SQL Editor if you see errors like:
--   relation "public.user_group_assignments" does not exist
--
-- Creates: subscription_group enum, pemabu_services, user_subscriptions,
-- user_group_assignments, RLS policies, grants, catalog seed (incl.
-- marketplace_import_token). Idempotent (safe to re-run).
-- STEP 2 — Then run: scripts/supabase-backfill-beta-all-profiles.sql
-- =============================================================================

-- ── Enum ─────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.subscription_group as enum ('beta','standard','trial','alumni');
exception when duplicate_object then null;
end $$;

-- ── Tables ───────────────────────────────────────────────────────────────────
create table if not exists public.pemabu_services (
  id           uuid        primary key default gen_random_uuid(),
  service_key  text        not null unique,
  display_name text        not null,
  description  text,
  category     text        not null
                           check (category in ('core','subscription','addon','upgrade','overage')),
  pricing_model text       not null
                           check (pricing_model in ('one_time','annual','per_event')),
  price_usd    numeric(10,2) not null default 0.00,
  is_active    boolean     not null default true,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  service_key  text        not null references public.pemabu_services(service_key) on delete restrict,
  status       text        not null default 'active'
                           check (status in ('active','cancelled','expired','complimentary','trial')),
  price_paid_usd numeric(10,2),
  granted_by   uuid        references auth.users(id),
  notes        text,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, service_key)
);

create table if not exists public.user_group_assignments (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade unique,
  subscription_group public.subscription_group not null default 'standard',
  assigned_by     uuid        references auth.users(id),
  assigned_at     timestamptz not null default now(),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── updated_at helper + triggers ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pemabu_services_updated_at on public.pemabu_services;
create trigger trg_pemabu_services_updated_at
  before update on public.pemabu_services
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_subscriptions_updated_at on public.user_subscriptions;
create trigger trg_user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_group_assignments_updated_at on public.user_group_assignments;
create trigger trg_user_group_assignments_updated_at
  before update on public.user_group_assignments
  for each row execute function public.set_updated_at();

-- ── RLS + policies (drop first so re-run is safe) ─────────────────────────────
alter table public.pemabu_services         enable row level security;
alter table public.user_subscriptions      enable row level security;
alter table public.user_group_assignments  enable row level security;

drop policy if exists "services_public_read" on public.pemabu_services;
create policy "services_public_read"
  on public.pemabu_services for select
  using (true);

drop policy if exists "subscriptions_owner_read" on public.user_subscriptions;
create policy "subscriptions_owner_read"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "groups_owner_read" on public.user_group_assignments;
create policy "groups_owner_read"
  on public.user_group_assignments for select
  using (auth.uid() = user_id);

-- ── Grants ───────────────────────────────────────────────────────────────────
grant select on public.pemabu_services         to authenticated;
grant select on public.user_subscriptions      to authenticated;
grant select on public.user_group_assignments  to authenticated;

grant all on public.pemabu_services         to service_role;
grant all on public.user_subscriptions      to service_role;
grant all on public.user_group_assignments  to service_role;

-- ── Catalog seed (15 rows + marketplace token) ─────────────────────────────
insert into public.pemabu_services
  (service_key, display_name, description, category, pricing_model, price_usd, is_active, sort_order)
values
  ('core_v1', 'Pemabu Core v1', 'Perpetual license for v1.x. Full local allocation engine, single portfolio, offline capable. All v1.x point releases free. Major version upgrade (v1 → v2) is a separate one-time fee.', 'core', 'one_time', 199.00, true, 1),
  ('intelligence_annual', 'Pemabu Intelligence', 'Multi-account (up to 10 portfolios), real-time price feeds, Watcher Agent (4-hour cycle), WebSocket Live Broadcast, political trade overlay, hedge fund 13F overlay, morning brief, scenario simulation (20 included/month).', 'subscription', 'annual', 229.00, true, 2),
  ('autonomous_annual', 'Pemabu Autonomous', 'Everything in Intelligence plus: WebRTC P2P broadcast, fiat and crypto execution (Alpaca, Kraken, Coinbase), trade approval queue, configurable guardrails, immutable audit ledger, tax lot tracking, bidirectional browser control, emergency stop. Unlimited scenario simulations.', 'subscription', 'annual', 899.00, true, 3),
  ('scenario_sim_overage', 'Scenario Simulation (overage)', 'Per simulation beyond the Intelligence soft cap of 20/month. Autonomous tier has unlimited simulations included.', 'overage', 'per_event', 0.50, true, 4),
  ('v1_to_v2_upgrade', 'Core v1 → v2 Upgrade', 'One-time upgrade fee for existing Core v1 perpetual license holders to access v2. New v2 purchasers pay full v2 price ($249). Available Year 2+.', 'upgrade', 'one_time', 99.00, true, 5),
  ('addon_defi_onchain', 'DeFi + On-Chain', 'Read-only wallet connect, staking position tracker, LP position tracker with impermanent loss calculator.', 'addon', 'annual', 49.00, true, 10),
  ('addon_macro_intelligence', 'Macro Intelligence', 'Weekly macro regime classification, regime-adjusted assumption suggestions, cross-asset correlation heatmap.', 'addon', 'annual', 39.00, true, 11),
  ('addon_options_overlay', 'Options Overlay', 'Track covered calls and puts, P&L on options positions, delta-adjusted portfolio exposure view.', 'addon', 'annual', 59.00, true, 12),
  ('addon_family_sharing', 'Family Sharing', 'Read-only consolidated dashboard shared with spouse or partner. No execution access. No portfolio data leaves the local device.', 'addon', 'annual', 49.00, true, 13),
  ('addon_data_vault_export', 'Data Vault Export', 'Automated weekly encrypted backup of all local Pemabu data to user-owned cloud storage (S3, Backblaze, or local NAS).', 'addon', 'annual', 19.00, true, 14),
  ('addon_governance_alerts', 'Governance Alert Layer', 'Monitor governance forums for tokens held in portfolio. Plain-English proposal summaries surfaced as Watcher Agent signals.', 'addon', 'annual', 39.00, true, 15),
  ('addon_political_tracker', 'Political Trade Tracker', 'Congressional disclosure filings surfaced as signals when overlapping with portfolio holdings.', 'addon', 'annual', 29.00, true, 16),
  ('addon_token_quality', 'Token Quality Score', 'Token Transparency Framework scoring (18 criteria) surfaced as an optional composite factor weight in the allocation engine.', 'addon', 'annual', 29.00, true, 17),
  ('live_broadcast_addon', 'Live Broadcast', 'WebSocket relay broadcast for Core-only users. View a single portfolio from any browser via secure session token. Included in Intelligence and Autonomous tiers.', 'addon', 'annual', 79.00, true, 18)
on conflict (service_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  category = excluded.category,
  pricing_model = excluded.pricing_model,
  price_usd = excluded.price_usd,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.pemabu_services (
  service_key,
  display_name,
  description,
  category,
  pricing_model,
  price_usd,
  is_active,
  sort_order
)
values (
  'marketplace_import_token',
  'Marketplace Import Token',
  'One-time token consumed when importing a Sleeve Blueprint strategy. '
  'Each import costs one token. Tokens do not expire. '
  'Beta users receive unlimited imports at no charge.',
  'overage',
  'per_event',
  4.99,
  true,
  19
)
on conflict (service_key) do update set
  display_name  = excluded.display_name,
  description   = excluded.description,
  price_usd     = excluded.price_usd,
  is_active     = excluded.is_active,
  sort_order    = excluded.sort_order,
  updated_at    = now();

-- ── Status check constraint (canonical set) ──────────────────────────────────
alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_status_check;

alter table public.user_subscriptions
  add constraint user_subscriptions_status_check
  check (status in (
    'active',
    'cancelled',
    'expired',
    'complimentary',
    'trial'
  ));

-- ── Verification row (editor shows a result grid) ────────────────────────────
select
  to_regclass('public.pemabu_services') is not null as pemabu_services_exists,
  to_regclass('public.user_subscriptions') is not null as user_subscriptions_exists,
  to_regclass('public.user_group_assignments') is not null as user_group_assignments_exists,
  (select count(*)::bigint from public.pemabu_services) as catalog_rows;
