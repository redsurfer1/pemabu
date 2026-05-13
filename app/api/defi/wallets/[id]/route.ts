import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertServiceAccess } from "@/lib/security/tier-guard";

const ADDON = "addon_defi_onchain";

export const DELETE = withAuth(async (_req, user, ctx) => {
  await assertServiceAccess(user.id, ADDON);

  const { id: idParam } = await ctx.params;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabaseAdmin.from("defi_wallets").delete().eq("id", id).eq("user_id", user.id);

  if (error) throw error;
  return NextResponse.json({ success: true });
});
