import { describe, expect, it } from "vitest";
import { computeStrategyGradeDecimal, computeDriftAccuracyScoreDecimal } from "@/lib/marketplace/strategy-grade-decimal";
import type { SleeveBlueprintV1 } from "@/lib/portfolio/export-sleeve-strategy";
import { d } from "@/lib/portfolio/precision-money";

function minimalBlueprint(): SleeveBlueprintV1 {
  return {
    version: 1,
    schema: "pemabu.sleeve_blueprint.v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    nonce: "n",
    weighting_method: "MANUAL",
    budget_pct: "0.25",
    purpose: "Growth",
    watcher_config: { driftAlertThresholdPct: "5", notes: "" },
    target_allocation: [
      {
        slot: 0,
        theme: "Broad",
        status: "Active",
        target_wt_pct: "50",
        expense_ratio: "0.0005",
        sort_order: 0,
      },
      {
        slot: 1,
        theme: "Broad",
        status: "Active",
        target_wt_pct: "50",
        expense_ratio: "0.0005",
        sort_order: 1,
      },
    ],
    aggregate_signal_quality: { target_weighted_rsi: "55" },
  };
}

describe("strategy-grade-decimal", () => {
  it("grades blueprint-only with Decimal paths", () => {
    const g = computeStrategyGradeDecimal(minimalBlueprint());
    expect(Number(g.strategy_grade)).toBeGreaterThan(0);
    expect(Number(g.strategy_grade)).toBeLessThanOrEqual(100);
  });

  it("maps drift accuracy with Decimal", () => {
    expect(computeDriftAccuracyScoreDecimal(d(0)).toNumber()).toBe(100);
    expect(computeDriftAccuracyScoreDecimal(d(15)).toNumber()).toBe(0);
  });
});
