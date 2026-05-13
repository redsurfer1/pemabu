import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

const ADDON = "addon_family_sharing";

export const DELETE = withAuth(async (_req, user, context) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!keys.includes(ADDON)) {
    return NextResponse.json({ error: "Family Sharing subscription required." }, { status: 403 });
  }

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
});
