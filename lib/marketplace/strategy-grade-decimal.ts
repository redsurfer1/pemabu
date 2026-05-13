import Decimal from "decimal.js";
import { d } from "@/lib/portfolio/precision-money";
import type { SleeveBlueprintV1 } from "@/lib/portfolio/export-sleeve-strategy";

export type OwnerSignalMetrics = {
  /** Live value-weighted RSI (14) from positions, or null if not computable */
  liveVwRsi: Decimal | null;
  /** Mean absolute drift in percentage points (|actual wt − target wt|) */
  meanAbsDriftPct: Decimal | null;
};

/**
 * Decimal.js-only grade composition: blueprint structure, live VW-RSI, drift fidelity.
 * Outputs are privacy-safe aggregates (no tickers or balances in this function).
 */
export function computeBlueprintAdherenceDecimal(blueprint: SleeveBlueprintV1): Decimal {
  const slots = blueprint.target_allocation.length;
  if (slots === 0) return d(0);
  const equal = d(100).div(d(slots));
  let dev = d(0);
  for (const a of blueprint.target_allocation) {
    dev = dev.plus(d(a.target_wt_pct).minus(equal).abs());
  }
  const adherenceRaw = d(100).minus(dev.div(d(slots)));
  return Decimal.min(d(100), Decimal.max(d(0), d(adherenceRaw.toFixed(8))));
}

/** Map RSI (typically 0–100) to a 0–100 score with a soft floor/ceiling. */
export function computeVwRsiNormScoreDecimal(rsi: Decimal | null): Decimal {
  if (!rsi) return d(50);
  const rsiNorm = rsi.minus(d(30)).div(d(40)).mul(d(100));
  return Decimal.min(d(100), Decimal.max(d(0), d(rsiNorm.toFixed(8))));
}

/** 0 pp mean drift → 100; 15+ pp → 0 (linear). */
export function computeDriftAccuracyScoreDecimal(meanAbsDriftPct: Decimal | null): Decimal {
  if (!meanAbsDriftPct) return d(50);
  const cap = d(15);
  const clamped = Decimal.min(meanAbsDriftPct.abs(), cap);
  return d(100).minus(clamped.div(cap).mul(d(100)));
}

export function computeStrategyGradeDecimal(
  blueprint: SleeveBlueprintV1,
  owner?: OwnerSignalMetrics | null,
): {
  strategy_grade: string;
  blueprint_adherence_score: string;
  vw_rsi_performance_score: string;
} {
  const adherence = computeBlueprintAdherenceDecimal(blueprint);

  const blueprintRsiStr = blueprint.aggregate_signal_quality?.target_weighted_rsi ?? null;
  const rsiSource =
    owner?.liveVwRsi ??
    (blueprintRsiStr != null && String(blueprintRsiStr).trim() !== "" ? d(String(blueprintRsiStr)) : null);
  const vwScore = computeVwRsiNormScoreDecimal(rsiSource);
  const driftScore = computeDriftAccuracyScoreDecimal(owner?.meanAbsDriftPct ?? null);

  const grade = adherence
    .mul(d("0.40"))
    .plus(vwScore.mul(d("0.35")))
    .plus(driftScore.mul(d("0.25")));

  return {
    strategy_grade: grade.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    blueprint_adherence_score: adherence.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    vw_rsi_performance_score: vwScore.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
  };
}
