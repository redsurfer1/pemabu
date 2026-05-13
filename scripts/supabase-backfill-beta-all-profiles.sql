-- =============================================================================
-- Paste into Supabase SQL Editor (Dashboard → SQL → New query)
--
-- PREREQUISITE: If `user_group_assignments` / `pemabu_services` do not exist,
-- run scripts/supabase-bootstrap-pricing-schema.sql first, then re-run this file.
--
-- 1) Creates assign_beta_grant_atomic if missing (same logic as repo migration)
-- 2) Backfills every user_profiles row → beta + complimentary active services
-- =============================================================================

-- ── 1) RPC: beta group + complimentary rows for all active pemabu_services ───
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

-- ── 2) Backfill all existing profiles (explicit ::text avoids "unknown" type) ─
do $$
declare
  r         record;
  n_applied integer := 0;
  j         jsonb;
begin
  for r in select id from public.user_profiles
  loop
    j := public.assign_beta_grant_atomic(
      r.id,
      null::uuid,
      'SQL editor backfill: beta + complimentary for all existing profiles'::text
    );
    if coalesce((j ->> 'success')::boolean, false) then
      n_applied := n_applied + 1;
    else
      raise warning 'assign_beta_grant_atomic failed for user_id=%: %', r.id, j;
    end if;
  end loop;

  raise notice 'Backfill complete: assign_beta_grant_atomic succeeded for % user_profiles row(s).', n_applied;
end;
$$;

-- ── 3) Verification (fails soft if STEP 1 bootstrap was never run) ───────────
select
  to_regclass('public.user_group_assignments') is not null as pricing_schema_ready,
  case when to_regclass('public.user_profiles') is not null
       then (select count(*)::bigint from public.user_profiles) end as user_profiles_total,
  case when to_regclass('public.user_group_assignments') is not null
       then (select count(*)::bigint from public.user_group_assignments where subscription_group = 'beta') end as rows_in_beta_group,
  case when to_regclass('public.user_subscriptions') is not null
       then (select count(*)::bigint from public.user_subscriptions where status = 'complimentary') end as complimentary_subscription_rows,
  case when to_regclass('public.user_subscriptions') is not null
       then (select count(distinct user_id)::bigint from public.user_subscriptions where status = 'complimentary') end as users_with_complimentary_row;
