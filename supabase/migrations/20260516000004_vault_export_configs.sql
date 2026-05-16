-- Vault Export configuration: one row per user.
-- Credentials are stored encrypted (AES-256-GCM via lib/security/encryption.ts).

create table if not exists public.vault_export_configs (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users (id) on delete cascade unique,
  -- 's3' | 'backblaze' | 'nas'
  provider             text        not null check (provider in ('s3', 'backblaze', 'nas')),
  bucket_name          text        null,
  region               text        null,
  endpoint_url         text        null,   -- Backblaze custom endpoint or NAS SMB share path
  -- AES-256-GCM ciphertext of JSON credentials (access key + secret, or NAS credentials).
  encrypted_credentials text       not null,
  is_enabled           boolean     not null default true,
  last_export_at       timestamptz null,
  last_export_status   text        null,   -- 'success' | 'error' | null
  last_export_error    text        null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.vault_export_configs enable row level security;

create policy "Users manage own vault_export_configs"
  on public.vault_export_configs for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.vault_export_configs to authenticated;
grant all    on public.vault_export_configs to service_role;
