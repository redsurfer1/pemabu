-- user_profiles: extends auth.users with app role
-- role: 'owner' (standard beta user) | 'admin' (operator)
-- Created automatically on first sign-in via trigger

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id)
    on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: users can read their own profile
-- Admin reads all profiles via service role only
alter table public.user_profiles enable row level security;

create policy "users_read_own_profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

create policy "users_update_own_profile"
  on public.user_profiles
  for update
  using (auth.uid() = id);

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',
             split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
