-- Separate IV / auth tag for API secret (GCM requires unique IV per ciphertext).

ALTER TABLE public.exchange_credentials
  ADD COLUMN IF NOT EXISTS secret_iv text,
  ADD COLUMN IF NOT EXISTS secret_auth_tag text;

COMMENT ON COLUMN public.exchange_credentials.iv IS 'IV for encrypted_api_key (AES-256-GCM).';
COMMENT ON COLUMN public.exchange_credentials.auth_tag IS 'Auth tag for encrypted_api_key.';
COMMENT ON COLUMN public.exchange_credentials.secret_iv IS 'IV for encrypted_secret.';
COMMENT ON COLUMN public.exchange_credentials.secret_auth_tag IS 'Auth tag for encrypted_secret.';
