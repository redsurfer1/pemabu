-- Token Transparency Framework (TTF) scores: one row per ticker, refreshed weekly by watcher.
-- 18 criteria — see lib/token-quality/ttf-scorer.ts for definitions.

create table if not exists public.token_ttf_scores (
  id               uuid        primary key default gen_random_uuid(),
  ticker           text        not null unique,
  -- Overall score 0-100 (weighted sum of 18 boolean/partial criteria).
  composite_score  integer     not null check (composite_score between 0 and 100),
  -- Individual criteria flags stored as JSONB (criterion_key → true|false|null).
  criteria         jsonb       not null default '{}',
  -- Human-readable signals for UI display.
  summary_flags    text[]      not null default '{}',
  -- Data source metadata.
  sources          jsonb       not null default '{}',
  scored_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_token_ttf_scores_ticker
  on public.token_ttf_scores (ticker);

create index if not exists idx_token_ttf_scores_composite
  on public.token_ttf_scores (composite_score desc);

alter table public.token_ttf_scores enable row level security;

create policy "Authenticated read token_ttf_scores"
  on public.token_ttf_scores for select
  to authenticated
  using (true);

grant select on public.token_ttf_scores to authenticated;
grant all    on public.token_ttf_scores to service_role;
