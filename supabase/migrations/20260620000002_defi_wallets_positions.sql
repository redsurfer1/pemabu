-- DeFi: read-only wallet addresses and cached positions (no keys).

create table if not exists public.defi_wallets (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  address    text        not null,
  chain      text        not null check (chain in (
               'ethereum','bitcoin','solana','base','arbitrum','polygon'
             )),
  label      text,
  created_at timestamptz not null default now(),
  unique (user_id, address, chain)
);

create index if not exists idx_defi_wallets_user on public.defi_wallets (user_id);

alter table public.defi_wallets enable row level security;

create policy "defi_wallets_select_own"
  on public.defi_wallets for select
  using (auth.uid() = user_id);

create policy "defi_wallets_insert_own"
  on public.defi_wallets for insert
  with check (auth.uid() = user_id);

create policy "defi_wallets_delete_own"
  on public.defi_wallets for delete
  using (auth.uid() = user_id);

grant all on public.defi_wallets to service_role;
grant select, insert, delete on public.defi_wallets to authenticated;

create table if not exists public.defi_positions (
  id             uuid          primary key default gen_random_uuid(),
  wallet_id      uuid          not null references public.defi_wallets(id) on delete cascade,
  address        text          not null,
  chain          text          not null,
  asset_symbol   text          not null,
  asset_name     text,
  balance        numeric(24,8) not null default 0,
  usd_value      numeric(16,2),
  position_type  text          not null check (position_type in ('native','token','staking','lp')),
  protocol       text,
  lp_token_a     text,
  lp_token_b     text,
  lp_value_a     numeric(16,2),
  lp_value_b     numeric(16,2),
  impermanent_loss_pct numeric(8,4),
  fetched_at     timestamptz   not null default now(),
  unique (wallet_id, asset_symbol, position_type)
);

create index if not exists idx_defi_positions_wallet
  on public.defi_positions (wallet_id);

alter table public.defi_positions enable row level security;

create policy "defi_positions_select_own_wallets"
  on public.defi_positions for select
  using (
    exists (
      select 1 from public.defi_wallets w
      where w.id = defi_positions.wallet_id
        and w.user_id = auth.uid()
    )
  );

grant all on public.defi_positions to service_role;
grant select on public.defi_positions to authenticated;

comment on table public.defi_positions is
  'Cached on-chain positions for user wallets; populated by watcher / jobs — no chain calls in API routes.';
