-- drift_events: records when allocation crosses threshold
-- links to the signal it generated
-- threshold_pct: configured drift tolerance (e.g. 5.0 = 5%)
-- actual_pct: measured deviation at detection time

create table if not exists public.drift_events (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id)
    on delete cascade,
  holding_id uuid not null references public.portfolio_holdings(id)
    on delete cascade,
  signal_id uuid references public.signals(id)
    on delete set null,
  asset_class text not null,
  target_pct numeric(6, 2) not null,
  actual_pct numeric(6, 2) not null,
  threshold_pct numeric(6, 2) not null default 5.0,
  direction text not null
    check (direction in ('over', 'under')),
  detected_at timestamptz not null default now()
);

create index drift_events_portfolio_id_idx
  on public.drift_events(portfolio_id);

alter table public.drift_events enable row level security;

create policy "owner_read_drift_events"
  on public.drift_events
  for select
  using (
    portfolio_id in (
      select id from public.portfolios
      where user_id = auth.uid()
    )
  );

-- Drift events are inserted by cron (service role)
-- Users can only read them, not create/update/delete
