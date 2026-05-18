-- ATOMIC BETA GROUP ASSIGNMENT (function only; grants in 20260619000002)

CREATE OR REPLACE FUNCTION public.assign_beta_grant_atomic(
  p_user_id      uuid,
  p_assigned_by  uuid,
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_service_keys  text[];
  v_service_key   text;
  v_now           timestamptz := now();
  v_count         integer := 0;
BEGIN
  INSERT INTO public.user_group_assignments (
    user_id,
    subscription_group,
    assigned_by,
    assigned_at,
    notes,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    'beta',
    p_assigned_by,
    v_now,
    p_notes,
    v_now,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    subscription_group = 'beta',
    assigned_by        = p_assigned_by,
    assigned_at        = v_now,
    notes              = COALESCE(p_notes, user_group_assignments.notes),
    updated_at         = v_now;

  SELECT COALESCE(array_agg(service_key), '{}')
  INTO v_service_keys
  FROM public.pemabu_services
  WHERE is_active = true;

  FOREACH v_service_key IN ARRAY v_service_keys
  LOOP
    INSERT INTO public.user_subscriptions (
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
    VALUES (
      p_user_id,
      v_service_key,
      'complimentary',
      NULL,
      p_assigned_by,
      'Auto-granted via beta group assignment',
      v_now,
      NULL,
      v_now,
      v_now
    )
    ON CONFLICT (user_id, service_key) DO UPDATE SET
      status         = 'complimentary',
      price_paid_usd = NULL,
      ends_at        = NULL,
      notes          = 'Auto-granted via beta group assignment',
      updated_at     = v_now;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success',          true,
    'user_id',          p_user_id,
    'services_granted', v_count,
    'assigned_at',      v_now
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   SQLERRM
    );
END;
$fn$;
