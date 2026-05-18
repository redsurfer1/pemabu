-- Optimize assign_beta_grant_atomic: INSERT...SELECT instead of per-key loop.

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
  v_now           timestamptz := now();
  v_service_count integer;
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
  SELECT
    p_user_id,
    ps.service_key,
    'complimentary',
    NULL,
    p_assigned_by,
    'Auto-granted via beta group assignment',
    v_now,
    NULL,
    v_now,
    v_now
  FROM public.pemabu_services ps
  WHERE ps.is_active = true
  ON CONFLICT (user_id, service_key) DO UPDATE SET
    status         = 'complimentary',
    price_paid_usd = NULL,
    ends_at        = NULL,
    notes          = 'Auto-granted via beta group assignment',
    updated_at     = v_now;

  GET DIAGNOSTICS v_service_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',          true,
    'user_id',          p_user_id,
    'services_granted', v_service_count,
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
