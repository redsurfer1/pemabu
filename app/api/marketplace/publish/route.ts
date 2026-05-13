import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";
import { computeStrategyGrades } from "@/lib/marketplace/strategy-grade";
import { insertMarketplaceStrategy } from "@/lib/marketplace/vault-marketplace";
import { loadOwnerSleevePublishMetrics } from "@/lib/marketplace/sleeve-publish-metrics";
import type { SleeveBlueprintV1 } from "@/lib/portfolio/export-sleeve-strategy";
import { hashSleeveToken } from "@/lib/portfolio/export-sleeve-strategy";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = withAuth(async (req, user, _ctx) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const tierBlock = requireIntelligenceTier(keys);
  if (tierBlock) return tierBlock;

  let body: {
    sleeveToken?: string;
    displayName?: string;
    metadata?: Record<string, unknown>;
    sourceSleeveId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sleeveToken = body.sleeveToken?.trim();
  const displayName = body.displayName?.trim();
  if (!sleeveToken || !displayName) {
    return NextResponse.json({ error: "sleeveToken and displayName required" }, { status: 400 });
  }

  let blueprint: SleeveBlueprintV1;
  try {
    const json = Buffer.from(sleeveToken, "base64url").toString("utf8");
    blueprint = JSON.parse(json) as SleeveBlueprintV1;
  } catch {
    return NextResponse.json({ error: "Invalid sleeveToken" }, { status: 400 });
  }
  if (blueprint.schema !== "pemabu.sleeve_blueprint.v1") {
    return NextResponse.json({ error: "Unsupported blueprint schema" }, { status: 400 });
  }

  let ownerSignals = null;
  const src = body.sourceSleeveId?.trim();
  if (src) {
    const m = await loadOwnerSleevePublishMetrics(user.id, src);
    if (m) {
      ownerSignals = { liveVwRsi: m.liveVwRsi, meanAbsDriftPct: m.meanAbsDriftPct };
    }
  }

  const grades = computeStrategyGrades(blueprint, ownerSignals);
  const sleeve_token_hash = hashSleeveToken(sleeveToken);

  try {
    await insertMarketplaceStrategy(isLocalVaultExecutionPlane() ? null : await createClient(), {
      publisher_user_id: user.id,
      sleeve_token_hash,
      display_name: displayName.slice(0, 120),
      blueprint,
      strategy_grade: grades.strategy_grade,
      blueprint_adherence_score: grades.blueprint_adherence_score,
      vw_rsi_performance_score: grades.vw_rsi_performance_score,
      metadata: body.metadata ?? {},
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  if (!isLocalVaultExecutionPlane()) {
    const { error: refreshErr } = await supabaseAdmin.rpc("refresh_leaderboard_scores");
    if (refreshErr) {
      console.error("refresh_leaderboard_scores:", refreshErr.message);
    }
  }

  return NextResponse.json({ ok: true, sleeve_token_hash: sleeve_token_hash });
});
