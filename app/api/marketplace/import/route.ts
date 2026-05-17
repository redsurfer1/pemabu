import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enforceImportEntitlement, ImportEntitlementError } from "@/lib/marketplace/import-gate";

export const POST = withAuth(async (req, user, _ctx) => {
  let body: { portfolioId?: string; sleeveToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const portfolioId = body.portfolioId?.trim();
  const sleeveToken = body.sleeveToken?.trim();
  if (!portfolioId || !sleeveToken) {
    return NextResponse.json({ error: "portfolioId and sleeveToken required" }, { status: 400 });
  }

  const keys = await getActiveServiceKeysForUser(user.id);
  const tierBlock = requireIntelligenceTier(keys);
  if (tierBlock) return tierBlock;

  try {
    await enforceImportEntitlement(user.id, sleeveToken);
  } catch (err) {
    if (err instanceof ImportEntitlementError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    console.error("Import entitlement check failed:", err);
    return NextResponse.json({ error: "Marketplace lookup failed" }, { status: 500 });
  }

  const out = await importSleeveStrategy(user.id, portfolioId, sleeveToken);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });

  // Fire-and-forget leaderboard refresh — does not block import response (Task Group I)
  void (async () => {
    const { error: refreshErr } = await supabaseAdmin.rpc("refresh_leaderboard_scores");
    if (refreshErr) {
      console.error("refresh_leaderboard_scores (non-fatal):", refreshErr.message);
    }
  })();

  return NextResponse.json({ ok: true, sleeveId: out.sleeveId });
});
