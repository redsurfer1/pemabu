-- Live Broadcast session management.
-- Core users need live_broadcast_addon subscription; Intelligence/Autonomous included.
-- Sessions are ephemeral; viewer_token is a short-lived signed slug.

create table if not exists public.broadcast_sessions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  portfolio_id   uuid        not null references public.portfolios (id) on delete cascade,
  viewer_token   text        not null unique,
  -- SHA-256 of the raw token for future revocation queries.
  token_hash     text        not null unique,
  is_live        boolean     not null default false,
  last_ping_at   timestamptz null,
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  created_at     timestamptz not null default now()
);

create index if not exists idx_broadcast_sessions_user
  on public.broadcast_sessions (user_id);

create index if not exists idx_broadcast_sessions_token_hash
  on public.broadcast_sessions (token_hash);

alter table public.broadcast_sessions enable row level security;

create policy "Users manage own broadcast_sessions"
  on public.broadcast_sessions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public read via token (viewer page reads by token, no auth).
create policy "Public read broadcast_sessions by token"
  on public.broadcast_sessions for select
  to anon
  using (is_live = true and expires_at > now());

grant select, insert, update, delete on public.broadcast_sessions to authenticated;
grant select on public.broadcast_sessions to anon;
grant all    on public.broadcast_sessions to service_role;
