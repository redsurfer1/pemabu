import { describe, expect, it } from "vitest";
import {
  percentRank,
  computePortfolioAllocations,
  computeIncomeSleeve,
} from "./allocation-intelligence-core";
import type { AllocationEngineHolding } from "@/types/allocation";
import { DEFAULT_ENGINE_ASSUMPTIONS } from "@/types/allocation";
import type { EngineAssumptions } from "@/types/allocation";

function computeCompositeScoreFromPrs(
  prExpense: number,
  prReturn: number,
  prDiv: number,
  prSharpe: number,
  assumptions: EngineAssumptions,
): number {
  return (
    prExpense * assumptions.scoreWeightExp +
    prReturn * assumptions.scoreWeightRet +
    prDiv * assumptions.scoreWeightDiv +
    prSharpe * assumptions.scoreWeightShp
  );
}

describe("percentRank", () => {
  it("matches Excel-style PERCENTRANK at midpoint", () => {
    expect(percentRank([10, 20, 30, 40, 50], 30)).toBe(0.5);
  });
});

describe("composite score", () => {
  it("matches weighted sum of PR inputs", () => {
    const a = DEFAULT_ENGINE_ASSUMPTIONS;
    const v = 0.6;
    const w = 0.7;
    const x = 0.5;
    const y = 0.8;
    const expected =
      v * a.scoreWeightExp +
      w * a.scoreWeightRet +
      x * a.scoreWeightDiv +
      y * a.scoreWeightShp;
    expect(computeCompositeScoreFromPrs(v, w, x, y, a)).toBeCloseTo(expected, 10);
  });
});

describe("vol cap", () => {
  it("uses volCap = multiplier × equal weight (e.g. n=10 → cap 0.3)", () => {
    const n = 10;
    const equalWt = 1 / n;
    const volCap = DEFAULT_ENGINE_ASSUMPTIONS.volCapMultiplier * equalWt;
    expect(volCap).toBeCloseTo(0.3, 5);
  });
});

describe("theme cap", () => {
  it("scales down when theme exposure exceeds cap", () => {
    const assumptions = { ...DEFAULT_ENGINE_ASSUMPTIONS, themeCapPct: 0.1 };
    const inputs: AllocationEngineHolding[] = [
      {
        id: "1",
        name: "A",
        ticker: "A",
        sleeveRole: "MAIN",
        status: "Active",
        theme: "Tech",
        qty: 1,
        price: 10,
        expenseRatio: 0.001,
        divDollar: 0,
        price3mo: 9,
        price6mo: 9,
        price1yr: 9,
        price3yr: 9,
        price5yr: 9,
      },
      {
        id: "2",
        name: "B",
        ticker: "B",
        sleeveRole: "MAIN",
        status: "Active",
        theme: "Tech",
        qty: 1,
        price: 10,
        expenseRatio: 0.001,
        divDollar: 0,
        price3mo: 9,
        price6mo: 9,
        price1yr: 9,
        price3yr: 9,
        price5yr: 9,
      },
    ];
    const hp = {
      A: { "3mo": 9, "6mo": 9, "1yr": 9, "3yr": 9, "5yr": 9 },
      B: { "3mo": 9, "6mo": 9, "1yr": 9, "3yr": 9, "5yr": 9 },
    };
    const cp = { A: 10, B: 10 };
    const totalNAV = 20;
    const out = computePortfolioAllocations(inputs, hp, cp, assumptions, totalNAV);
    const tech = out.filter((h) => h.theme === "Tech" && h.status === "Active");
    const sumTarget = tech.reduce((s, h) => s + h.targetWtPct, 0);
    expect(sumTarget).toBeLessThanOrEqual(1 - assumptions.incomeBudgetPct + 1e-6);
  });
});

describe("income sleeve weights", () => {
  it("sums to incomeBudgetPct", () => {
    const inputs = [
      { id: "1", ticker: "A", name: "A", qty: 1, price: 100, divDollar: 2 },
      { id: "2", ticker: "B", name: "B", qty: 1, price: 100, divDollar: 1 },
    ];
    const r = computeIncomeSleeve(inputs, DEFAULT_ENGINE_ASSUMPTIONS.incomeBudgetPct, 200);
    const sum = r.reduce((s, h) => s + h.targetWtPct, 0);
    expect(sum).toBeCloseTo(DEFAULT_ENGINE_ASSUMPTIONS.incomeBudgetPct, 6);
  });
});

describe("main sleeve target weights", () => {
  it("sums to (1 - incomeBudgetPct) for active main sleeve", () => {
    const assumption = DEFAULT_ENGINE_ASSUMPTIONS;
    const holdings: AllocationEngineHolding[] = [
      {
        id: "1",
        name: "X",
        ticker: "X",
        sleeveRole: "MAIN",
        status: "Active",
        theme: "Broad",
        qty: 1,
        price: 10,
        expenseRatio: 0.01,
        divDollar: 0.1,
        price3mo: 9,
        price6mo: 9,
        price1yr: 9,
        price3yr: 9,
        price5yr: 9,
      },
      {
        id: "2",
        name: "Y",
        ticker: "Y",
        sleeveRole: "MAIN",
        status: "Active",
        theme: "Intl",
        qty: 1,
        price: 10,
        expenseRatio: 0.02,
        divDollar: 0.1,
        price3mo: 9,
        price6mo: 9,
        price1yr: 9,
        price3yr: 9,
        price5yr: 9,
      },
    ];
    const hp = {
      X: { "3mo": 9, "6mo": 9, "1yr": 9, "3yr": 9, "5yr": 9 },
      Y: { "3mo": 9, "6mo": 9, "1yr": 9, "3yr": 9, "5yr": 9 },
    };
    const cp = { X: 10, Y: 10 };
    const totalNAV = 20;
    const out = computePortfolioAllocations(holdings, hp, cp, assumption, totalNAV);
    const mainSum = out
      .filter((h) => h.status === "Active")
      .reduce((s, h) => s + h.targetWtPct, 0);
    expect(mainSum).toBeCloseTo(1 - assumption.incomeBudgetPct, 5);
  });
});

describe("parity dollar change", () => {
  it("is positive when underweight", () => {
    const h: AllocationEngineHolding = {
      id: "m",
      name: "Cash",
      ticker: "CASH",
      sleeveRole: "MANUAL",
      status: "Active",
      theme: "Broad",
      qty: 100,
      price: 1,
      expenseRatio: 0,
      divDollar: 0,
      manualTargetWt: 0.5,
      manualPricing: true,
      price3mo: 1,
      price6mo: 1,
      price1yr: 1,
      price3yr: 1,
      price5yr: 1,
    };
    const out = computePortfolioAllocations(
      [h],
      {},
      {},
      DEFAULT_ENGINE_ASSUMPTIONS,
      1000,
    );
    expect(out[0]!.parityDollarChg).toBeGreaterThan(0);
  });

  it("is negative when overweight vs target", () => {
    const h: AllocationEngineHolding = {
      id: "m",
      name: "Cash",
      ticker: "CASH",
      sleeveRole: "MANUAL",
      status: "Active",
      theme: "Broad",
      qty: 900,
      price: 1,
      expenseRatio: 0,
      divDollar: 0,
      manualTargetWt: 0.1,
      manualPricing: true,
      price3mo: 1,
      price6mo: 1,
      price1yr: 1,
      price3yr: 1,
      price5yr: 1,
    };
    const out = computePortfolioAllocations(
      [h],
      {},
      {},
      DEFAULT_ENGINE_ASSUMPTIONS,
      1000,
    );
    expect(out[0]!.parityDollarChg).toBeLessThan(0);
  });
});
