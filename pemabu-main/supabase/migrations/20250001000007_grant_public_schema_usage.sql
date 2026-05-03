-- PostgREST / Supabase: authenticated JWT role must be able to use schema public
-- Fixes: permission denied for schema public (42501) on API queries.

grant usage on schema public to authenticated;
grant usage on schema public to anon;
