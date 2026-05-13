create or replace function public.auto_grant_new_service_to_beta_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.is_active = false then
    return NEW;
  end if;

  insert into public.user_subscriptions (
    user_id,
    service_key,
    status,
    price_paid_usd,
    granted_by,
    notes,
    starts_at,
    ends_at,
    created_at,
    updated_at
  )
  select
    uga.user_id,
    NEW.service_key,
    'complimentary',
    null,
    null,
    'Auto-granted via beta trigger on new service activation',
    now(),
    null,
    now(),
    now()
  from public.user_group_assignments uga
  where uga.subscription_group = 'beta'
  on conflict (user_id, service_key) do nothing;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_grant_new_service_to_beta on public.pemabu_services;

create trigger trg_auto_grant_new_service_to_beta
  after insert on public.pemabu_services
  for each row
  execute function public.auto_grant_new_service_to_beta_users();

comment on trigger trg_auto_grant_new_service_to_beta on public.pemabu_services is
  'Auto-grants newly inserted active services to beta group users.';
