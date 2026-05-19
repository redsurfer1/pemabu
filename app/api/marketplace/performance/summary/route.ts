import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computePerformanceSummary } from "@/lib/sleeve-performance/utils";
import type { SleevePerformanceWeek } from "@/lib/types/sleeve-performance";

export const POST = withAuth(async (req, user) => {
  const body = await req.json().catch(() => ({}));
  const strategyId = String(body.strategyId ?? "").trim();

  if (!strategyId) {
    return NextResponse.json({ error: "strategyId required" }, { status: 400 });
  }

  const { data: summaryRow } = await supabaseAdmin
    .from("strategy_performance_summary")
    .select("total_weeks_tracked, avg_drift_pct, avg_composite_score, consistency")
    .eq("strategy_id", strategyId)
    .maybeSingle();

  if (summaryRow) {
    return NextResponse.json({
      summary: {
        totalWeeksTracked: summaryRow.total_weeks_tracked,
        avgDriftPct: summaryRow.avg_drift_pct,
        avgCompositeScore: summaryRow.avg_composite_score,
        consistency: summaryRow.consistency,
      },
    });
  }

  const { data: history } = await supabaseAdmin
    .from("sleeve_performance_log")
    .select(
      "recorded_week, avg_drift_pct, max_drift_pct, entry_signal_count, hold_signal_count, exit_signal_count, total_holdings_count, avg_composite_score, grade, was_published",
    )
    .eq("sleeve_id", strategyId)
    .order("recorded_week", { ascending: false });

  const weeks = (history ?? []) as SleevePerformanceWeek[];
  const computed = computePerformanceSummary(weeks);

  return NextResponse.json({
    summary: {
      totalWeeksTracked: computed.weeksTracked,
      avgDriftPct: computed.avgDriftPct,
      avgCompositeScore: computed.avgCompositeScore,
      consistency: computed.consistency,
    },
  });
}, { keyTemplate: "perf-summary:{userId}", ...READ_RATE_LIMIT });
