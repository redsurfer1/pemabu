-- MARKETPLACE IMPORT TOKEN SYSTEM

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
  'One-time token consumed when importing a Sleeve Blueprint strategy. Each import costs one token. Tokens do not expire. Beta users receive unlimited imports at no charge.',
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

create table if not exists public.marketplace_import_ledger (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  strategy_id       uuid        references public.marketplace_strategies(id) on delete set null,
  service_key       text        not null default 'marketplace_import_token',
  tokens_consumed   integer     not null default 1,
  price_per_token   numeric(10,2) not null default 4.99,
  total_charged_usd numeric(10,2) not null default 4.99,
  is_complimentary  boolean     not null default false,
  imported_at       timestamptz not null default now(),
  notes             text
);

create index if not exists idx_marketplace_import_ledger_user_id
  on public.marketplace_import_ledger (user_id);

create index if not exists idx_marketplace_import_ledger_strategy_id
  on public.marketplace_import_ledger (strategy_id);

create index if not exists idx_marketplace_import_ledger_imported_at
  on public.marketplace_import_ledger (imported_at desc);

alter table public.marketplace_import_ledger enable row level security;

do $policy$ begin
  create policy "users_read_own_import_ledger"
    on public.marketplace_import_ledger for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $policy$;

grant all on public.marketplace_import_ledger to service_role;
grant select on public.marketplace_import_ledger to authenticated;

comment on table public.marketplace_import_ledger is
  'Append-only ledger of Sleeve Blueprint import events. Revenue source: marketplace_import_token at $4.99 per import. Beta users are marked is_complimentary = true and are not charged.';
