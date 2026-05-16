-- Scenario simulation usage counter: one row per (user, month).
-- Enforces Intelligence soft cap (20/month) and enables overage billing.

create table if not exists public.scenario_simulation_events (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  -- ISO month key: 'YYYY-MM'
  month_key      text        not null,
  event_count    integer     not null default 0,
  -- Running sum of overage events that generated a Stripe checkout (not paid, just initiated).
  overage_billed integer     not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, month_key)
);

create index if not exists idx_scenario_sim_events_user_month
  on public.scenario_simulation_events (user_id, month_key);

alter table public.scenario_simulation_events enable row level security;

create policy "Users read own scenario_simulation_events"
  on public.scenario_simulation_events for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.scenario_simulation_events to authenticated;
grant all    on public.scenario_simulation_events to service_role;
