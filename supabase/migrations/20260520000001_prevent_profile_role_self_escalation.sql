-- Prevent authenticated users from self-escalating to admin via user_profiles.role updates.
-- Role changes must go through service-role admin tooling only.

create or replace function public.enforce_user_profile_role_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if auth.role() = 'authenticated' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_role_immutable on public.user_profiles;

create trigger trg_user_profiles_role_immutable
  before update on public.user_profiles
  for each row
  execute function public.enforce_user_profile_role_immutable();
