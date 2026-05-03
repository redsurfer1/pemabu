-- Fix service_role grants (supabaseAdmin / service role key)
-- Ensures admin API routes can read counts and manage data across public tables.

grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;

grant all on all sequences in schema public to service_role;

-- Promote an operator to admin (run manually in SQL Editor — use your auth.users id):
--
--   update public.user_profiles
--     set role = 'admin'
--     where id = '<paste-uuid-from-auth.users>';
--
-- Verify:
--
--   select id, role, display_name from public.user_profiles;
