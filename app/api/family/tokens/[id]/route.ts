import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertServiceAccess } from "@/lib/security/tier-guard";

const ADDON = "addon_family_sharing";

export const DELETE = withAuth(async (_req, user, context) => {
  await assertServiceAccess(user.id, ADDON);

  const params = await context.params;
  const raw = params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("family_share_tokens")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_user_id", user.id);

  if (error) throw error;
  return NextResponse.json({ success: true });
}, { keyTemplate: "family:{userId}", ...MUTATION_RATE_LIMIT });
