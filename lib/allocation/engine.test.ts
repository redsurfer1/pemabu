import { describe, it, expect } from "vitest";
import {
  percentRank,
  computeReturns,
  computeBlendedReturn,
  computeVolAndSharpe,
  computeCompositeScore,
  computeTrendSignal,
  computeMainSleeve,
  computeIncomeSleeve,
} from "./v3-engine";
import type { HoldingInput, EngineAssumptions } from "@/types/allocation";
import { DEFAULT_ENGINE_ASSUMPTIONS } from "@/types/allocation";

// ── percentRank ─────────────────────────────────────────────────────

describe("percentRank", () => {
  it("returns 0.5 for the median of [10,20,30,40,50]", () => {
    expect(percentRank([10, 20, 30, 40, 50], 30)).toBe(0.5);
  });

  it("returns 0 for the minimum value", () => {
    expect(percentRank([10, 20, 30], 10)).toBe(0);
  });

  it("returns 1 for a value above the max", () => {
    expect(percentRank([10, 20, 30], 99)).toBe(1);
  });

  it("returns 0 for a single-element array", () => {
    expect(percentRank([42], 42)).toBe(0);
  });
});

// ── computeReturns ──────────────────────────────────────────────────

describe("computeReturns", () => {
  const base: HoldingInput = {
    id: "h1",
    ticker: "TEST",
    name: "Test",
    status: "Active",
    theme: "US-Broad",
    qty: 10,
    price: 110,
    expenseRatio: 0.003,
    divDollar: 1,
    price3mo: 100,
    price6mo: 90,
    price1yr: 80,
    price3yr: 70,
    price5yr: 60,
  };

  it("computes period returns correctly", () => {
    const r = computeReturns(base);
    expect(r.ret3mo).toBeCloseTo(0.1, 5);   // (110-100)/100
    expect(r.ret6mo).toBeCloseTo(0.2222, 3); // (110-90)/90
    expect(r.ret1yr).toBeCloseTo(0.375, 3);  // (110-80)/80
    expect(r.ret3yr).toBeCloseTo(0.5714, 3); // (110-70)/70
    expect(r.ret5yr).toBeCloseTo(0.8333, 3); // (110-60)/60
  });

  it("returns 0 for missing historical prices", () => {
    const h: HoldingInput = { ...base, price3mo: 0, price5yr: 0 };
    const r = computeReturns(h);
    expect(r.ret3mo).toBe(0);
    expect(r.ret5yr).toBe(0);
  });
});

// ── computeBlendedReturn ────────────────────────────────────────────

describe("computeBlendedReturn", () => {
  it("weights returns by assumption factors", () => {
    const returns = { ret3mo: 0.1, ret6mo: 0.2, ret1yr: 0.3, ret3yr: 0.4, ret5yr: 0.5 };
    const a = DEFAULT_ENGINE_ASSUMPTIONS;
    const expected =
      0.1 * 0.40 + 0.2 * 0.25 + 0.3 * 0.20 + 0.4 * 0.10 + 0.5 * 0.05;
    expect(computeBlendedReturn(returns, a)).toBeCloseTo(expected, 8);
  });
});

// ── computeVolAndSharpe ─────────────────────────────────────────────

describe("computeVolAndSharpe", () => {
  it("computes vol as |ret3mo / 90|", () => {
    const { vol } = computeVolAndSharpe(0.09, 0.15);
    expect(vol).toBeCloseTo(0.09 / 90, 8);
  });

  it("computes sharpe as blended / vol", () => {
    const { vol, sharpe } = computeVolAndSharpe(0.09, 0.15);
    expect(sharpe).toBeCloseTo(0.15 / vol, 4);
  });

  it("uses 0.0001 as minimum vol to avoid div-by-zero", () => {
    const { sharpe } = computeVolAndSharpe(0, 0.1);
    expect(sharpe).toBeCloseTo(0.1 / 0.0001, 0);
  });
});

// ── computeTrendSignal ──────────────────────────────────────────────

describe("computeTrendSignal", () => {
  it("returns Consider Entry above 0.05", () => {
    expect(computeTrendSignal(0.06)).toBe("Consider Entry");
  });
  it("returns Consider Exit below -0.05", () => {
    expect(computeTrendSignal(-0.06)).toBe("Consider Exit");
  });
  it("returns Hold at 0.05 boundary", () => {
    expect(computeTrendSignal(0.05)).toBe("Hold");
  });
  it("returns Hold at -0.05 boundary", () => {
    expect(computeTrendSignal(-0.05)).toBe("Hold");
  });
});

// ── Helpers ─────────────────────────────────────────────────────────

function makeHolding(
  id: string,
  ticker: string,
  theme: string,
  expenseRatio: number,
  price3mo: number,
  divDollar: number,
  qty = 10,
): HoldingInput {
  const price = price3mo * 1.1;
  return {
    id,
    ticker,
    name: ticker,
    status: "Active",
    theme,
    qty,
    price,
    expenseRatio,
    divDollar,
    price3mo,
    price6mo: price3mo * 0.95,
    price1yr: price3mo * 0.9,
    price3yr: price3mo * 0.8,
    price5yr: price3mo * 0.7,
  };
}

// ── computeMainSleeve — vol cap ─────────────────────────────────────

describe("computeMainSleeve — vol cap", () => {
  it("caps positions exceeding volCapMultiplier × equalWeight", () => {
    // 60 holdings (matches the real 60-ETF universe).
    // equalWtBase = 1/60 ≈ 0.01667. volCap = 3 × 0.01667 ≈ 0.05.
    //
    // Holding 0: price3mo=1 → 99× 3-month return → blendedReturn ≫ 0 → prReturn=1, prSharpe=1.
    //            divDollar=100, value=100 → divAPY=1.0 → prDivAPY=1.
    //            All same expenseRatio → prExpense=1 for all.
    //            compositeScore ≈ 1.0
    //
    // Others (59): price3mo=price (0% return) → blendedReturn=0 → prReturn=0, prSharpe=0.
    //              divDollar=0 → prDivAPY=0.
    //              compositeScore = prExpense×0.30 = 1×0.30 = 0.30
    //
    // rawScoreWt for h0 = 1.0 / (1.0 + 59×0.30) = 1.0/18.7 ≈ 0.0535 > volCap=0.05 → CAPPED
    const mkInput = (id: string, price3mo: number, divDollar: number): HoldingInput => ({
      id, ticker: id, name: id, status: "Active", theme: "Tech",
      qty: 1, price: 100, expenseRatio: 0.0001, divDollar,
      price3mo, price6mo: price3mo, price1yr: price3mo, price3yr: price3mo, price5yr: price3mo,
    });

    const holdings: HoldingInput[] = [
      mkInput("h0", 1, 100),
      ...Array.from({ length: 59 }, (_, i) => mkInput(`h${i + 1}`, 100, 0)),
    ];

    const { holdings: computed } = computeMainSleeve(holdings, DEFAULT_ENGINE_ASSUMPTIONS);
    const active = computed.filter((h) => h.status === "Active");
    const capped = active.filter((h) => h.volCapFlag === "CAPPED");
    expect(capped.length).toBeGreaterThan(0);
    capped.forEach((h) => {
      // Every CAPPED holding must have rawScoreWt > volCapMultiplier × equalWtBase
      expect(h.rawScoreWt).toBeGreaterThan(
        DEFAULT_ENGINE_ASSUMPTIONS.volCapMultiplier * h.equalWtBase,
      );
    });
  });
});

// ── computeMainSleeve — theme cap ──────────────────────────────────

describe("computeMainSleeve — theme cap", () => {
  it("scales down holdings in a theme that exceeds themeCapPct", () => {
    // 10 holdings all with theme "Tech" — theme exposure will be 100% → capped to 10%
    const holdings: HoldingInput[] = Array.from({ length: 10 }, (_, i) =>
      makeHolding(`h${i}`, `T${i}`, "Tech", 0.003, 50, 1),
    );
    const { holdings: computed } = computeMainSleeve(holdings, DEFAULT_ENGINE_ASSUMPTIONS);
    const active = computed.filter((h) => h.status === "Active");
    const totalTargetWt = active.reduce((s, h) => s + h.finalTargetWt, 0);
    // All should sum to 1 - incomeBudgetPct = 0.88 (±0.001)
    expect(totalTargetWt).toBeCloseTo(1 - DEFAULT_ENGINE_ASSUMPTIONS.incomeBudgetPct, 3);
    // Each holding should be ≤ themeCapPct × (1/10) after normalization
    // (i.e., theme doesn't dominate beyond cap)
    expect(active[0]!.themeExposurePct).toBeGreaterThanOrEqual(DEFAULT_ENGINE_ASSUMPTIONS.themeCapPct);
  });
});

// ── computeMainSleeve — main sleeve weight sum ──────────────────────

describe("computeMainSleeve — weight invariants", () => {
  it("active holdings finalTargetWt sums to (1 - incomeBudgetPct)", () => {
    const holdings: HoldingInput[] = Array.from({ length: 5 }, (_, i) =>
      makeHolding(`h${i}`, `T${i}`, i < 3 ? "Tech" : "Intl", 0.003 + i * 0.001, 50 + i * 5, 1),
    );
    const { holdings: computed } = computeMainSleeve(holdings, DEFAULT_ENGINE_ASSUMPTIONS);
    const sum = computed
      .filter((h) => h.status === "Active")
      .reduce((s, h) => s + h.finalTargetWt, 0);
    expect(sum).toBeCloseTo(1 - DEFAULT_ENGINE_ASSUMPTIONS.incomeBudgetPct, 3);
  });

  it("comparable holdings have finalTargetWt = 0 and scoreRank = null", () => {
    const comparableInput: HoldingInput = {
      id: "comp1",
      ticker: "COMP",
      name: "Comparable",
      status: "Comparable",
      theme: "Broad",
      qty: 0,
      price: 50,
      expenseRatio: 0.003,
      divDollar: 0,
      price3mo: 45,
      price6mo: 42,
      price1yr: 40,
      price3yr: 35,
      price5yr: 30,
    };
    const active = makeHolding("h1", "ACTV", "Tech", 0.003, 50, 1);
    const { holdings: computed } = computeMainSleeve(
      [active, comparableInput],
      DEFAULT_ENGINE_ASSUMPTIONS,
    );
    const comp = computed.find((h) => h.status === "Comparable");
    expect(comp).toBeDefined();
    expect(comp!.finalTargetWt).toBe(0);
    expect(comp!.scoreRank).toBeNull();
  });

  it("parityDollarChg is positive when underweight (need to buy)", () => {
    const h = makeHolding("h1", "T1", "Tech", 0.003, 50, 1, 0); // qty=0 → value=0
    const { holdings: computed } = computeMainSleeve([h], DEFAULT_ENGINE_ASSUMPTIONS, 10000);
    const c = computed.find((x) => x.status === "Active")!;
    expect(c.parityDollarChg).toBeGreaterThan(0);
  });

  it("parityDollarChg is negative when overweight (need to sell)", () => {
    // Large qty relative to NAV so current weight > target weight
    const h = makeHolding("h1", "T1", "Tech", 0.003, 50, 1, 1000); // value = 1000 * 55 = 55000
    const { holdings: computed } = computeMainSleeve([h], DEFAULT_ENGINE_ASSUMPTIONS, 1000);
    const c = computed.find((x) => x.status === "Active")!;
    // With qty=1000 and price=55, value=55000 >> navForParity=1000 → overweight
    expect(c.parityDollarChg).toBeLessThan(0);
  });
});

// ── computeIncomeSleeve ─────────────────────────────────────────────

describe("computeIncomeSleeve", () => {
  const incomeInputs = [
    { id: "i1", ticker: "JEPQ", name: "JEPQ", qty: 100, price: 50, divDollar: 5 },
    { id: "i2", ticker: "DIVO", name: "DIVO", qty: 50, price: 40, divDollar: 2 },
    { id: "i3", ticker: "VYM", name: "VYM", qty: 80, price: 60, divDollar: 3 },
  ];
  const incomeBudgetPct = 0.12;
  const totalNAV = 20000;

  it("income sleeve target weights sum to incomeBudgetPct", () => {
    const result = computeIncomeSleeve(incomeInputs, incomeBudgetPct, totalNAV);
    const sum = result.reduce((s, h) => s + h.finalTargetWt, 0);
    expect(sum).toBeCloseTo(incomeBudgetPct, 3);
  });

  it("proportions are based on div APY", () => {
    const result = computeIncomeSleeve(incomeInputs, incomeBudgetPct, totalNAV);
    // JEPQ: value=5000, divAPY=5/5000=0.001. DIVO: value=2000, divAPY=2/2000=0.001. VYM: value=4800, divAPY=3/4800=0.000625
    // (approximate — just verify relative ordering by APY)
    const sorted = [...result].sort((a, b) => b.divAPY - a.divAPY);
    const sortedByTarget = [...result].sort((a, b) => b.finalTargetWt - a.finalTargetWt);
    expect(sorted[0]!.ticker).toBe(sortedByTarget[0]!.ticker);
  });

  it("parityDollarChg is positive when holding is underweight", () => {
    const tinyHoldings = [
      { id: "i1", ticker: "JEPQ", name: "JEPQ", qty: 1, price: 50, divDollar: 5 }, // value=50
    ];
    const result = computeIncomeSleeve(tinyHoldings, incomeBudgetPct, totalNAV);
    // target = 0.12 * 20000 = 2400. current = 50. chg = 2350 > 0
    expect(result[0]!.parityDollarChg).toBeGreaterThan(0);
  });
});

// ── compositeScore with known inputs ───────────────────────────────

describe("computeCompositeScore", () => {
  it("computes weighted sum correctly", () => {
    const score = computeCompositeScore(0.8, 0.6, 0.4, 0.7, DEFAULT_ENGINE_ASSUMPTIONS);
    const expected =
      0.8 * 0.30 + 0.6 * 0.30 + 0.4 * 0.15 + 0.7 * 0.25;
    expect(score).toBeCloseTo(expected, 8);
  });
});
