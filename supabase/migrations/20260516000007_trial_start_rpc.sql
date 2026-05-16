-- Self-serve trial start: assigns the calling user to 'trial' group and grants
-- 30-day trial subscriptions for the core bundle services.
-- Idempotent: no-ops if the user is already in any group.

create or replace function public.start_trial_self_serve(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_group text;
  v_now            timestamptz := now();
  v_ends_at        timestamptz := now() + interval '30 days';
  v_trial_keys     text[] := array[
    'core_v1',
    'intelligence_annual',
    'autonomous_annual',
    'live_broadcast_addon',
    'addon_political_tracker'
  ];
  v_key            text;
  v_count          integer := 0;
begin
  -- Block if already in any group.
  select subscription_group into v_existing_group
  from public.user_group_assignments
  where user_id = p_user_id;

  if v_existing_group is not null then
    return jsonb_build_object(
      'ok', false,
      'error', 'already_in_group',
      'group', v_existing_group
    );
  end if;

  -- Assign to trial group.
  insert into public.user_group_assignments (
    user_id, subscription_group, assigned_by, assigned_at, notes, created_at, updated_at
  )
  values (
    p_user_id, 'trial', p_user_id, v_now, 'Self-serve trial start', v_now, v_now
  )
  on conflict (user_id) do nothing;

  -- Grant 30-day trial subscriptions for the bundle.
  foreach v_key in array v_trial_keys
  loop
    insert into public.user_subscriptions (
      user_id, service_key, status, price_paid_usd, granted_by, notes,
      starts_at, ends_at, renewal_mode, created_at, updated_at
    )
    values (
      p_user_id, v_key, 'trial', 0, p_user_id, 'Self-serve 30-day trial',
      v_now, v_ends_at, 'one_time', v_now, v_now
    )
    on conflict (user_id, service_key) do nothing;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'group', 'trial',
    'ends_at', v_ends_at,
    'services_granted', v_count
  );
end;
$$;

grant execute on function public.start_trial_self_serve(uuid) to service_role;
