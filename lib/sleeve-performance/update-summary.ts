import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { computePerformanceSummary } from "@/lib/sleeve-performance/utils";
import type { SleevePerformanceWeek } from "@/lib/types/sleeve-performance";

export async function updateStrategyPerformanceSummary(strategyId: string): Promise<void> {
  const { data: history, error } = await supabaseAdmin
    .from("sleeve_performance_log")
    .select(
      "recorded_week, avg_drift_pct, max_drift_pct, entry_signal_count, hold_signal_count, exit_signal_count, total_holdings_count, avg_composite_score, grade, was_published",
    )
    .eq("sleeve_id", strategyId)
    .order("recorded_week", { ascending: false });

  if (error) {
    console.error("[update-summary] Failed to load performance log:", error.message);
    return;
  }

  const weeks = (history ?? []) as SleevePerformanceWeek[];
  const summary = computePerformanceSummary(weeks);

  const { error: upsertError } = await supabaseAdmin
    .from("strategy_performance_summary")
    .upsert(
      {
        strategy_id: strategyId,
        total_weeks_tracked: summary.weeksTracked,
        avg_drift_pct: summary.avgDriftPct,
        avg_composite_score: summary.avgCompositeScore,
        consistency: summary.consistency,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "strategy_id" },
    );

  if (upsertError) {
    console.error("[update-summary] Upsert failed:", upsertError.message);
  }
}
