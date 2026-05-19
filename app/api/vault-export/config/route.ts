import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encryptUtf8 } from "@/lib/security/encryption";
import { READ_RATE_LIMIT, SENSITIVE_RATE_LIMIT } from "@/lib/security/rate-limiter";

const ConfigSchema = z.object({
  provider: z.enum(["s3", "backblaze", "nas"]),
  bucket_name: z.string().min(1).optional(),
  region: z.string().optional(),
  endpoint_url: z.string().optional(),
  is_enabled: z.boolean().optional().default(true),
  // Raw credentials to encrypt. Never stored in plaintext.
  credentials: z.object({
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    endpoint: z.string().optional(),
  }),
});

// GET: retrieve the current config (credentials are masked).
export const GET = withAuth(async (_req, user) => {
  await assertServiceAccess(user.id, "addon_data_vault_export");

  const { data, error } = await supabaseAdmin
    .from("vault_export_configs")
    .select("id, provider, bucket_name, region, endpoint_url, is_enabled, last_export_at, last_export_status, last_export_error")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ config: data ?? null });
}, { keyTemplate: "vault:{userId}", ...READ_RATE_LIMIT });

// PUT: create or replace the export config.
export const PUT = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, "addon_data_vault_export");

  let body: z.infer<typeof ConfigSchema>;
  try {
    body = ConfigSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid config body" }, { status: 400 });
  }

  const { credentials, ...rest } = body;

  // Encrypt credentials before storage.
  let encrypted_credentials: string;
  try {
    const encResult = encryptUtf8(JSON.stringify(credentials));
    encrypted_credentials = JSON.stringify(encResult);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Encryption failed — check MASTER_VAULT_KEY" },
      { status: 500 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("vault_export_configs")
    .upsert(
      {
        user_id: user.id,
        ...rest,
        encrypted_credentials,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("id, provider, bucket_name, region, endpoint_url, is_enabled")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ config: data });
}, { keyTemplate: "vault:{userId}", ...SENSITIVE_RATE_LIMIT });

// DELETE: remove the export config.
export const DELETE = withAuth(async (_req, user) => {
  await assertServiceAccess(user.id, "addon_data_vault_export");

  const { error } = await supabaseAdmin
    .from("vault_export_configs")
    .delete()
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}, { keyTemplate: "vault:{userId}", ...SENSITIVE_RATE_LIMIT });
