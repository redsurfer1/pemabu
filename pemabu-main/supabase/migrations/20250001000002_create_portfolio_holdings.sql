-- portfolio_holdings: positions within a portfolio
-- source tracks how the holding was entered
-- current_price refreshed by nightly cron

create table if not exists public.portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id)
    on delete cascade,
  ticker text not null,
  name text,
  asset_class text not null default 'equity'
    check (asset_class in (
      'equity', 'fixed_income', 'alternatives',
      'cash', 'other'
    )),
  quantity numeric(18, 6) not null default 0,
  cost_basis numeric(18, 4),
  current_price numeric(18, 4),
  currency text not null default 'USD',
  source text not null default 'manual'
    check (source in ('manual', 'upload', 'csv_import')),
  last_price_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(portfolio_id, ticker)
);

create index holdings_portfolio_id_idx
  on public.portfolio_holdings(portfolio_id);

alter table public.portfolio_holdings
  enable row level security;

-- Owner accesses holdings through portfolio ownership
create policy "owner_all_holdings"
  on public.portfolio_holdings
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
