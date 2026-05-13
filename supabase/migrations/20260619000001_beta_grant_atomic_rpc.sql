-- ─────────────────────────────────────────────────────────────────────────────
-- ATOMIC BETA GROUP ASSIGNMENT
-- Assigns a user to the beta group AND grants all active services
-- as complimentary subscriptions in a single database transaction.
-- If either operation fails, the entire transaction rolls back.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_service_keys  text[];
  v_service_key   text;
  v_now           timestamptz := now();
  v_count         integer := 0;
begin
  -- Step 1: Upsert the group assignment
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

  -- Step 2: Get all active service keys
  select coalesce(array_agg(service_key), '{}')
  into v_service_keys
  from public.pemabu_services
  where is_active = true;

  -- Step 3: Upsert one complimentary subscription per active service
  foreach v_service_key in array v_service_keys
  loop
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
    values (
      p_user_id,
      v_service_key,
      'complimentary',
      null,
      p_assigned_by,
      'Auto-granted via beta group assignment',
      v_now,
      null,
      v_now,
      v_now
    )
    on conflict (user_id, service_key) do update set
      status             = 'complimentary',
      price_paid_usd     = null,
      ends_at            = null,
      notes              = 'Auto-granted via beta group assignment',
      updated_at         = v_now;

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'success',           true,
    'user_id',           p_user_id,
    'services_granted',  v_count,
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

comment on function public.assign_beta_grant_atomic(uuid, uuid, text) is
  'Atomically assigns a user to the beta subscription group and grants '
  'complimentary access to all active Pemabu services. '
  'Both operations succeed or both roll back — no partial state.';
