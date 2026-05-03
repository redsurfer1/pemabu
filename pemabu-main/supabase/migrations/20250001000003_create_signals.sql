-- signals: all alerts and insights for a portfolio
-- type covers every signal source in the platform
-- trend type replaces the retired /api/trend-watch endpoint
-- status tracks the user acknowledgment lifecycle

create type public.signal_type as enum (
  'drift',               -- allocation deviated beyond threshold
  'trend',               -- price movement vs benchmark
  'brief',               -- AI weekly narrative
  'price_refresh_error', -- market data provider failure
  'assumption_drift'     -- preset assumptions stale
);

create type public.signal_severity as enum (
  'info', 'warning', 'critical'
);

create type public.signal_status as enum (
  'unacknowledged', 'acknowledged', 'resolved'
);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id)
    on delete cascade,
  holding_id uuid references public.portfolio_holdings(id)
    on delete set null,
  type public.signal_type not null,
  severity public.signal_severity not null default 'info',
  status public.signal_status not null
    default 'unacknowledged',
  title text not null,
  message text,
  metadata jsonb default '{}',
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index signals_portfolio_id_idx
  on public.signals(portfolio_id);
create index signals_portfolio_status_idx
  on public.signals(portfolio_id, status);
create index signals_type_idx
  on public.signals(type);

alter table public.signals enable row level security;

create policy "owner_all_signals"
  on public.signals
  for all
  using (
    portfolio_id in (
      select id from public.portfolios
      where user_id = auth.uid()
    )
  )
  with check (
    portfolio_id in (
      select id from public.portfolios
      where user_id = auth.uid()
    )
  );
