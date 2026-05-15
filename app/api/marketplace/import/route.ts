import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertMarketplaceImportUnlock } from "@/lib/marketplace/assert-import-unlock";

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

  let gate: Awaited<ReturnType<typeof assertMarketplaceImportUnlock>>;
  try {
    gate = await assertMarketplaceImportUnlock(user.id, sleeveToken);
  } catch {
    return NextResponse.json({ error: "Marketplace lookup failed" }, { status: 500 });
  }
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message, code: gate.code }, { status: gate.status });
  }

  const out = await importSleeveStrategy(user.id, portfolioId, sleeveToken);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });

  const { error: refreshErr } = await supabaseAdmin.rpc("refresh_leaderboard_scores");
  if (refreshErr) {
    console.error("refresh_leaderboard_scores:", refreshErr.message);
  }

  return NextResponse.json({ ok: true, sleeveId: out.sleeveId });
});
