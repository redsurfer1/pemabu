import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

const ADDON = "addon_governance_alerts";

export const DELETE = withAuth(async (_req, user, context) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!keys.includes(ADDON)) {
    return NextResponse.json({ error: "Governance Alert subscription required." }, { status: 403 });
  }

  const params = await context.params;
  const raw = params.ticker;
  const ticker = Array.isArray(raw) ? raw[0] : raw;
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("governance_watch_list")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("token_ticker", ticker.toUpperCase());

  if (error) throw error;
  return NextResponse.json({ success: true });
});
