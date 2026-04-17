-- portfolios: top-level container, owned directly by user
-- Beta: auth.uid() = user_id is the ONLY access pattern
-- No portfolio_assignments table at beta

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id)
    on delete cascade,
  name text not null,
  description text,
  currency text not null default 'USD'
    check (currency in ('USD', 'GBP', 'EUR', 'CAD', 'AUD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portfolios_user_id_idx
  on public.portfolios(user_id);

alter table public.portfolios enable row level security;

-- Owner can do everything with their own portfolios
create policy "owner_all_portfolios"
  on public.portfolios
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
