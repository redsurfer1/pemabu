-- Options overlay: per-portfolio options positions (manual entry / tracking).

create table if not exists public.options_positions (
  id                 uuid          primary key default gen_random_uuid(),
  user_id            uuid          not null references auth.users(id) on delete cascade,
  portfolio_id       uuid          not null references public.portfolios(id) on delete cascade,
  underlying_ticker  text          not null,
  option_type        text          not null check (option_type in ('call', 'put')),
  strategy           text          not null check (strategy in (
                        'covered_call', 'protective_put',
                        'cash_secured_put', 'long_call', 'long_put'
                      )),
  strike_price       numeric(12,4) not null,
  expiration_date    date          not null,
  contracts          integer       not null check (contracts > 0),
  premium_paid       numeric(12,4) not null,
  current_price      numeric(12,4),
  delta              numeric(6,4),
  notes              text,
  created_at         timestamptz   not null default now(),
  updated_at         timestamptz   not null default now()
);

create index if not exists idx_options_positions_user_portfolio
  on public.options_positions (user_id, portfolio_id);

create index if not exists idx_options_positions_expiration
  on public.options_positions (expiration_date asc);

alter table public.options_positions enable row level security;

create policy "options_positions_select_own"
  on public.options_positions for select
  using (auth.uid() = user_id);

create policy "options_positions_insert_own"
  on public.options_positions for insert
  with check (auth.uid() = user_id);

create policy "options_positions_delete_own"
  on public.options_positions for delete
  using (auth.uid() = user_id);

grant all on public.options_positions to service_role;
grant select, insert, delete on public.options_positions to authenticated;

comment on table public.options_positions is
  'User-tracked options overlay positions; not exchange-synced fills.';
