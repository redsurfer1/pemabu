-- ─────────────────────────────────────────────────────────────────────────────
-- FAMILY SHARING
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.family_share_tokens (
  id              uuid    primary key default gen_random_uuid(),
  owner_user_id   uuid    not null references auth.users(id) on delete cascade,
  token_hash      text    not null unique,
  viewer_label    text    not null default 'Family View',
  show_total_value    boolean not null default true,
  show_drift_status   boolean not null default true,
  show_allocation_pct boolean not null default true,
  show_sector_weights boolean not null default false,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  last_accessed_at timestamptz,
  revoked_at      timestamptz
);

create table if not exists public.family_share_access_log (
  id          uuid    primary key default gen_random_uuid(),
  token_id    uuid    not null references public.family_share_tokens(id) on delete cascade,
  accessed_at timestamptz not null default now(),
  access_note text
);

create index if not exists idx_family_share_tokens_owner
  on public.family_share_tokens (owner_user_id);

create index if not exists idx_family_share_tokens_hash
  on public.family_share_tokens (token_hash);

alter table public.family_share_tokens     enable row level security;
alter table public.family_share_access_log enable row level security;

create policy "owners_manage_share_tokens"
  on public.family_share_tokens
  for all
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

create policy "owners_read_access_log"
  on public.family_share_access_log for select
  using (
    exists (
      select 1 from public.family_share_tokens t
      where t.id = family_share_access_log.token_id
        and t.owner_user_id = auth.uid()
    )
  );

grant all on public.family_share_tokens     to service_role;
grant all on public.family_share_access_log to service_role;
grant select, insert, update, delete on public.family_share_tokens to authenticated;
grant select on public.family_share_access_log to authenticated;

comment on table public.family_share_tokens is
  'Read-only access tokens for Family Sharing add-on. '
  'Token hash stored — raw token is shown once to the owner and never stored. '
  'No portfolio data stored here — data served via Live Broadcast relay.';
