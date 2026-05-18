DO $grant$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.assign_beta_grant_atomic(uuid, uuid, text) FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.assign_beta_grant_atomic(uuid, uuid, text) TO service_role';
END $grant$;
