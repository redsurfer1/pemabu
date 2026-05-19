-- 20260710000005_public_api_keys.sql
-- Public API keys for programmatic access to Pemabu platform data.

CREATE TABLE IF NOT EXISTS public.public_api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  label         text NOT NULL DEFAULT '',
  key_hash      text NOT NULL UNIQUE,
  key_prefix    text NOT NULL DEFAULT '',
  scopes        text[] NOT NULL DEFAULT '{}',
  is_active     boolean NOT NULL DEFAULT true,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_public_api_keys_user
  ON public.public_api_keys (user_id);

ALTER TABLE public.public_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_api_keys_select_own
  ON public.public_api_keys FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY public_api_keys_insert_own
  ON public.public_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY public_api_keys_update_own
  ON public.public_api_keys FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY public_api_keys_delete_own
  ON public.public_api_keys FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_api_keys TO authenticated;
GRANT ALL ON public.public_api_keys TO service_role;

COMMENT ON TABLE public.public_api_keys IS
  'User-managed API keys for programmatic access. Only key_hash stored; raw key shown once at creation.';
COMMENT ON COLUMN public.public_api_keys.key_prefix IS
  'First few characters of the raw key for UI display (e.g. pemabu_abc123...).';
COMMENT ON COLUMN public.public_api_keys.scopes IS
  'Array of permission scopes granted to this key (e.g. {portfolios:read,signals:read}).';
