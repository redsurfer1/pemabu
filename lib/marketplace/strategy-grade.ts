import type { SleeveBlueprintV1 } from "@/lib/portfolio/export-sleeve-strategy";
import {
  computeStrategyGradeDecimal,
  type OwnerSignalMetrics,
} from "@/lib/marketplace/strategy-grade-decimal";

export { computeBlueprintAdherenceDecimal, computeVwRsiNormScoreDecimal } from "@/lib/marketplace/strategy-grade-decimal";

/**
 * Privacy-safe aggregate scores for leaderboard rows (no positions or balances).
 * Uses Decimal.js for all financial composition math.
 */
export function computeStrategyGrades(
  blueprint: SleeveBlueprintV1,
  ownerSignals?: OwnerSignalMetrics | null,
): {
  strategy_grade: string;
  blueprint_adherence_score: string;
  vw_rsi_performance_score: string;
} {
  return computeStrategyGradeDecimal(blueprint, ownerSignals ?? undefined);
}
