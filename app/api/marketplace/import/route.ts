import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { hashSleeveToken } from "@/lib/portfolio/export-sleeve-strategy";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  const out = await importSleeveStrategy(user.id, portfolioId, sleeveToken);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });

  const { data: grp } = await supabaseAdmin
    .from("user_group_assignments")
    .select("subscription_group")
    .eq("user_id", user.id)
    .maybeSingle();
  const isBeta = grp?.subscription_group === "beta";

  const tokenHash = hashSleeveToken(sleeveToken);
  const { data: strat } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id")
    .eq("sleeve_token_hash", tokenHash)
    .maybeSingle();

  if (strat?.id) {
    const { error: ledgerError } = await supabaseAdmin.from("marketplace_import_ledger").insert({
      user_id: user.id,
      strategy_id: strat.id,
      service_key: "marketplace_import_token",
      tokens_consumed: 1,
      price_per_token: 4.99,
      total_charged_usd: isBeta ? 0.0 : 4.99,
      is_complimentary: isBeta,
      notes: isBeta ? "Beta user — complimentary import" : "Standard import token consumed",
    });
    if (ledgerError) {
      console.error("marketplace_import_ledger write failed:", ledgerError);
    }
  }

  return NextResponse.json({ ok: true, sleeveId: out.sleeveId });
});
