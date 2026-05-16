CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz DEFAULT now()
);

DO $body$
BEGIN
  CREATE ROLE authenticated;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$body$;

DO $body$
BEGIN
  CREATE ROLE anon;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$body$;

DO $body$
BEGIN
  CREATE ROLE service_role;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$body$;

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;

DO $body$
BEGIN
  CREATE PUBLICATION supabase_realtime;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$body$;

SELECT 'Bootstrap complete' AS status;