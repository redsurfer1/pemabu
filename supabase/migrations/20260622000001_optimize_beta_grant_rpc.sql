-- Optimize assign_beta_grant_atomic: INSERT...SELECT instead of per-key loop.

create or replace function public.assign_beta_grant_atomic(
  p_user_id      uuid,
  p_assigned_by  uuid,
  p_notes        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now           timestamptz := now();
  v_service_count integer;
begin
  insert into public.user_group_assignments (
    user_id,
    subscription_group,
    assigned_by,
    assigned_at,
    notes,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    'beta',
    p_assigned_by,
    v_now,
    p_notes,
    v_now,
    v_now
  )
  on conflict (user_id) do update set
    subscription_group = 'beta',
    assigned_by        = p_assigned_by,
    assigned_at        = v_now,
    notes              = coalesce(p_notes, user_group_assignments.notes),
    updated_at         = v_now;

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
    p_user_id,
    ps.service_key,
    'complimentary',
    null,
    p_assigned_by,
    'Auto-granted via beta group assignment',
    v_now,
    null,
    v_now,
    v_now
  from public.pemabu_services ps
  where ps.is_active = true
  on conflict (user_id, service_key) do update set
    status             = 'complimentary',
    price_paid_usd     = null,
    ends_at            = null,
    notes              = 'Auto-granted via beta group assignment',
    updated_at         = v_now;

  get diagnostics v_service_count = row_count;

  return jsonb_build_object(
    'success',           true,
    'user_id',           p_user_id,
    'services_granted',  v_service_count,
    'assigned_at',       v_now
  );

exception
  when others then
    return jsonb_build_object(
      'success', false,
      'error',   sqlerrm
    );
end;
$$;

revoke all on function public.assign_beta_grant_atomic(uuid, uuid, text) from public;
grant execute on function public.assign_beta_grant_atomic(uuid, uuid, text) to service_role;
