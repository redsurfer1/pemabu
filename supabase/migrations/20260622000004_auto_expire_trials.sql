create or replace function public.expire_elapsed_trials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer;
begin
  update public.user_subscriptions
  set
    status     = 'expired',
    updated_at = now()
  where status   = 'trial'
    and ends_at is not null
    and ends_at < now();

  get diagnostics v_expired = row_count;

  return coalesce(v_expired, 0);
end;
$$;

revoke all on function public.expire_elapsed_trials() from public;
grant execute on function public.expire_elapsed_trials() to service_role;

comment on function public.expire_elapsed_trials is
  'Expires trial subscriptions past ends_at.';
