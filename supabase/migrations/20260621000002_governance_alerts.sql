-- ─────────────────────────────────────────────────────────────────────────────
-- GOVERNANCE ALERT LAYER
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.governance_watch_list (
  id          uuid    primary key default gen_random_uuid(),
  user_id     uuid    not null references auth.users(id) on delete cascade,
  token_ticker text   not null,
  token_name  text,
  space_id    text,
  is_active   boolean not null default true,
  added_at    timestamptz not null default now(),
  unique(user_id, token_ticker)
);

create table if not exists public.governance_proposals (
  id                  uuid    primary key default gen_random_uuid(),
  token_ticker        text    not null,
  external_id         text    not null,
  source              text    not null,
  title               text    not null,
  body_preview        text,
  plain_english_summary text,
  state               text    not null,
  vote_deadline       timestamptz,
  quorum_required     numeric(20,0),
  votes_for           numeric(20,0),
  votes_against       numeric(20,0),
  votes_abstain       numeric(20,0),
  url                 text,
  fetched_at          timestamptz not null default now(),
  unique(external_id, source)
);

create table if not exists public.governance_user_alerts (
  id              uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references auth.users(id) on delete cascade,
  proposal_id     uuid    not null references public.governance_proposals(id) on delete cascade,
  token_ticker    text    not null,
  is_read         boolean not null default false,
  is_dismissed    boolean not null default false,
  alerted_at      timestamptz not null default now(),
  unique(user_id, proposal_id)
);

create index if not exists idx_gov_watch_list_user
  on public.governance_watch_list (user_id);
create index if not exists idx_gov_proposals_ticker
  on public.governance_proposals (token_ticker, state);
create index if not exists idx_gov_user_alerts_user
  on public.governance_user_alerts (user_id, is_read, alerted_at desc);

alter table public.governance_watch_list  enable row level security;
alter table public.governance_proposals   enable row level security;
alter table public.governance_user_alerts enable row level security;

do $$ begin
  create policy "users_own_watch_list"
    on public.governance_watch_list
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "authenticated_read_proposals"
    on public.governance_proposals for select
    using (auth.role() = 'authenticated');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users_own_alerts"
    on public.governance_user_alerts
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

grant all on public.governance_watch_list  to service_role;
grant all on public.governance_user_alerts to service_role;
grant all on public.governance_proposals   to service_role;
grant select, insert, delete on public.governance_watch_list  to authenticated;
grant select, insert, update, delete on public.governance_user_alerts to authenticated;
grant select                  on public.governance_proposals   to authenticated;
