-- Per-portfolio API credentials (encrypted at rest). Optional Tiingo key for market data;
-- optional exchange keys for Autonomous execution scoped to a portfolio.

create table if not exists public.portfolio_api_credentials (
  id                  uuid        primary key default gen_random_uuid(),
  portfolio_id        uuid        not null references public.portfolios (id) on delete cascade,
  user_id             uuid        not null references auth.users (id) on delete cascade,
  provider            text        not null
                      check (provider in ('tiingo', 'alpaca', 'kraken', 'coinbase_advanced')),
  encrypted_api_key   text        not null,
  encrypted_secret    text,
  iv                  text        not null,
  auth_tag            text        not null,
  secret_iv           text,
  secret_auth_tag     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (portfolio_id, provider)
);

create index if not exists portfolio_api_credentials_portfolio_idx
  on public.portfolio_api_credentials (portfolio_id);

create index if not exists portfolio_api_credentials_user_idx
  on public.portfolio_api_credentials (user_id);

drop trigger if exists trg_portfolio_api_credentials_updated_at on public.portfolio_api_credentials;
create trigger trg_portfolio_api_credentials_updated_at
  before update on public.portfolio_api_credentials
  for each row execute function public.set_updated_at();

alter table public.portfolio_api_credentials enable row level security;

drop policy if exists "portfolio_api_credentials_owner" on public.portfolio_api_credentials;
create policy "portfolio_api_credentials_owner"
  on public.portfolio_api_credentials
  for all
  to authenticated
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.portfolio_api_credentials to authenticated;
grant all on public.portfolio_api_credentials to service_role;
