-- Congressional disclosure cache for Political Trade Tracker watcher job.
-- Source: House Stock Watcher public API (housestockwatcher.com/api).
-- Watcher fetches daily; rows are upserted by (representative, ticker, transaction_date, filed_at_date).

create table if not exists public.congressional_disclosures (
  id                uuid        primary key default gen_random_uuid(),
  representative    text        not null,
  party             text        null,
  state             text        null,
  ticker            text        not null,
  asset_description text        null,
  asset_type        text        null,
  transaction_type  text        null,   -- 'purchase' | 'sale'
  amount_range      text        null,   -- e.g. '$1,001 - $15,000'
  transaction_date  date        not null,
  filed_at_date     date        null,
  disclosure_date   date        null,
  industry          text        null,
  sector            text        null,
  fetched_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create unique index if not exists idx_congressional_disclosures_dedup
  on public.congressional_disclosures (representative, ticker, transaction_date, coalesce(filed_at_date, '1970-01-01'));

create index if not exists idx_congressional_disclosures_ticker
  on public.congressional_disclosures (ticker);

create index if not exists idx_congressional_disclosures_transaction_date
  on public.congressional_disclosures (transaction_date desc);

-- RLS: readable by authenticated users (entitlement enforced at API layer).
alter table public.congressional_disclosures enable row level security;

create policy "Authenticated read congressional_disclosures"
  on public.congressional_disclosures for select
  to authenticated
  using (true);

grant select on public.congressional_disclosures to authenticated;
grant all    on public.congressional_disclosures to service_role;
