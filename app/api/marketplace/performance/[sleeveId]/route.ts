import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier, tierMeetsMinimum } from "@/lib/security/tier-guard";
import { PERFORMANCE_HISTORY_NOTICE } from "@/lib/constants/performance-history";
import { computePerformanceSummary } from "@/lib/sleeve-performance/utils";
import type { SleevePerformanceWeek } from "@/lib/types/sleeve-performance";

const SPARKLINE_WEEKS = 4;
const FULL_HISTORY_WEEKS = 104;

export const GET = withAuth(async (req, user, ctx) => {
  const params = await ctx.params;
  const sleeveId = String(params.sleeveId ?? "").trim();
  if (!sleeveId) {
    return NextResponse.json({ error: "sleeveId required" }, { status: 400 });
  }

  const { data: strategy, error: stratError } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id, display_name")
    .eq("id", sleeveId)
    .maybeSingle();

  if (stratError || !strategy) {
    return NextResponse.json({ error: "Strategy not found or not published" }, { status: 404 });
  }

  const keys = await getActiveServiceKeysForUser(user.id);
  const tier = resolveEffectiveTier(keys);
  const isIntelligence = tierMeetsMinimum(tier, "INTELLIGENCE");
  const weeksLimit = isIntelligence ? FULL_HISTORY_WEEKS : SPARKLINE_WEEKS;

  const { data: history, error: histError } = await supabaseAdmin
    .from("sleeve_performance_log")
    .select(
      "recorded_week, avg_drift_pct, max_drift_pct, entry_signal_count, hold_signal_count, exit_signal_count, total_holdings_count, avg_composite_score, grade, was_published",
    )
    .eq("sleeve_id", sleeveId)
    .order("recorded_week", { ascending: false })
    .limit(weeksLimit);

  if (histError) {
    console.error("[performance API] Load failed:", histError.message);
    return NextResponse.json({ error: "Failed to load performance history" }, { status: 500 });
  }

  const weeks = (history ?? []) as SleevePerformanceWeek[];
  const summary = computePerformanceSummary(weeks);

  return NextResponse.json({
    sleeveId,
    strategyName: strategy.display_name,
    tier: isIntelligence ? "full" : "preview",
    weeksAvailable: weeks.length,
    weeksShown: weeks.length,
    previewOnly: !isIntelligence,
    upgradeRequired: !isIntelligence && weeks.length >= SPARKLINE_WEEKS,
    history: weeks,
    summary,
    notice: PERFORMANCE_HISTORY_NOTICE,
    dataAsOf: weeks[0]?.recorded_week ?? null,
  });
});
