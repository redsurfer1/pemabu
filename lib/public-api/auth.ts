import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashApiKey } from "./utils";

export type ApiKeyPayload = {
  userId: string;
  keyId: string;
  scopes: string[];
};

export async function authenticateApiKey(req: Request): Promise<ApiKeyPayload | null> {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;

  const rawKey = auth.slice("Bearer ".length).trim();
  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);

  const { data, error } = await supabaseAdmin
    .from("public_api_keys")
    .select("id, user_id, scopes, is_active, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.is_active || data.revoked_at) return null;

  const row = data as {
    id: string;
    user_id: string;
    scopes: string[];
    is_active: boolean;
    revoked_at: string | null;
  };

  await supabaseAdmin
    .from("public_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);

  return { userId: row.user_id, keyId: row.id, scopes: row.scopes ?? [] };
}
