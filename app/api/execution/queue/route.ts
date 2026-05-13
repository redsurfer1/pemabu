import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { requireAutonomousTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";
import { listTradeProposalsForUserVault, isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

/** List trade proposals — Autonomous tier; respects local vault vs hosted Supabase. */
export const GET = withAuth(async (req, user, _ctx) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const denied = requireAutonomousTier(keys);
  if (denied) return denied;

  const raw = new URL(req.url).searchParams.get("limit");
  const n = raw ? Number(raw) : 25;
  const limit = Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 25;

  if (isLocalVaultExecutionPlane()) {
    const proposals = await listTradeProposalsForUserVault(user.id, limit);
    return NextResponse.json({ proposals });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trade_proposals")
    .select(
      "id, portfolio_id, sleeve_id, holding_id, ticker, action, quantity, status, exchange_name, drift_pct, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
});

/** Reserved for future queue mutations — Autonomous tier only. */
export const POST = withAuth(async (_req, user, _ctx) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const denied = requireAutonomousTier(keys);
  if (denied) return denied;
  return NextResponse.json({ ok: true, queued: 0 });
});
