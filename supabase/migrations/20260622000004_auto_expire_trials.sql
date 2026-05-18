create or replace function public.expire_elapsed_trials()
returns integer
language plpgsql
security definer
set search_path = public
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public.expire_elapsed_trials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_elapsed_trials() TO service_role;
