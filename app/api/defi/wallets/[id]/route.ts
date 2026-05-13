import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

const ADDON = "addon_defi_onchain";

export const DELETE = withAuth(async (_req, user, ctx) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!keys.includes(ADDON)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idParam } = await ctx.params;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseAdmin.from("defi_wallets").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw error;
  return NextResponse.json({ success: true });
});
