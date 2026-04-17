-- allocation_snapshots: point-in-time allocation state
-- append-only by convention (no updates, no deletes)
-- snapshot_data: full allocation breakdown as JSON
-- triggered_by: what caused the snapshot

create table if not exists public.allocation_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id)
    on delete cascade,
  snapshot_data jsonb not null,
  total_value numeric(18, 2),
  currency text not null default 'USD',
  triggered_by text not null default 'manual'
    check (triggered_by in (
      'manual', 'nightly_cron', 'price_refresh', 'upload'
    )),
  created_at timestamptz not null default now()
  -- No updated_at — snapshots are immutable by convention
);

create index snapshots_portfolio_id_idx
  on public.allocation_snapshots(portfolio_id);
create index snapshots_created_at_idx
  on public.allocation_snapshots(portfolio_id, created_at desc);

alter table public.allocation_snapshots
  enable row level security;

create policy "owner_read_snapshots"
  on public.allocation_snapshots
  for select
  using (
    portfolio_id in (
      select id from public.portfolios
      where user_id = auth.uid()
    )
  );

-- Snapshots are inserted by cron or manual trigger
-- Users read them; service role inserts them
-- INSERT policy intentionally omitted for user role:
-- all inserts go through service role (cron/API)
