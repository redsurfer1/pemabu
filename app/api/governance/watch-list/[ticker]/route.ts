import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";

const ADDON = "addon_governance_alerts";

export const DELETE = withAuth(async (_req, user, context) => {
  await assertServiceAccess(user.id, ADDON);

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
}, { keyTemplate: "governance:{userId}", ...MUTATION_RATE_LIMIT });
