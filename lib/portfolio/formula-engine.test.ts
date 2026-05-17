import { describe, expect, test } from "vitest";
import {
  DEFAULT_ASSUMPTIONS,
  colAA,
  colAB,
  colAC,
  colAD,
  colAK,
  colAL,
  colAM,
  colAR,
  colAS,
  colAT,
  colAU,
  colD,
  colH,
  colJ,
  colO,
  colP,
  colV,
  colW,
  colX,
  colY,
  colZ,
  computePortfolioRanks,
  computeRSI,
  denseRank,
  normaliseWeights,
} from "./formula-engine";

describe("formula-engine", () => {
  test("colJ", () => {
    // VEA: 597 shares × $67.63 = $40,375.11 (verified against Excel row 4)
    expect(colJ(597, 67.63)).toBeCloseTo(40375.11, 4);
  });

  test("colD", () => {
    expect(colD(40385.11, 516823.47)).toBeCloseTo(0.0781435026, 4);
  });

  test("colH", () => {
    expect(colH(0, 40385.11)).toBe(0);
    expect(colH(119, 40385.11)).toBeCloseTo(0.0029471272, 4);
  });

  test("colO", () => {
    expect(colO(48.13, 48.09)).toBeCloseTo(0.0008317738, 4);
  });

  test("colP", () => {
    expect(colP(48.13, 46.39)).toBeCloseTo(0.0375080836, 4);
  });

  test("colV", () => {
    expect(colV(48.13, 46.59)).toBeCloseTo(0.0330543035, 4);
  });

  test("colW", () => {
    expect(colW(48.13, 44.61)).toBeCloseTo(0.0789051782, 4);
  });

  test("colX", () => {
    expect(colX(48.13, 41.2)).toBeCloseTo(0.1682038835, 4);
  });

  test("colY", () => {
    expect(colY(48.13, 37.79)).toBeCloseTo(0.2736173591, 4);
  });

  test("colZ", () => {
    expect(colZ(48.13, 34.27)).toBeCloseTo(0.4044353662, 4);
  });

  test("colAA", () => {
    expect(colAA([0.033068, 0.078905, 0.168204, 0.273617, 0.404438])).toBeCloseTo(0.1916464, 4);
  });

  test("colAB", () => {
    expect(
      colAB(
        0.033068,
        0.078905,
        0.168204,
        0.273617,
        0.404438,
        { r3mo: 0.4, r6mo: 0.25, r1yr: 0.2, r3yr: 0.1, r5yr: 0.05 },
      ),
    ).toBeCloseTo(0.114178, 4);
  });

  test("colAC", () => {
    expect(colAC(0.033068)).toBeCloseTo(0.0003674222, 4);
  });

  test("colAD", () => {
    expect(colAD(0.033068)).toBeCloseTo(0.0003674222, 4);
    expect(colAD(-0.06)).toBeCloseTo(-0.0006666667, 4);
  });

  test("colAK", () => {
    const legacyWeights = {
      ...DEFAULT_ASSUMPTIONS.factor_weights,
      expense: 0.3,
      pctWeight: 0,
      weightedReturn: 0.3,
      divApy: 0.15,
      volatility: 0.25,
      thirteenF: 0,
      macroIntelligence: 0,
      governanceLayer: 0,
      politicalTracker: 0,
      tokenQuality: 0,
    };
    expect(colAK(2, 18, 5, 72, legacyWeights)).toBe(24.75);
  });

  test("colAL", () => {
    expect(colAL(0.06)).toBe("Consider Entry");
    expect(colAL(-0.06)).toBe("Consider Exit");
    expect(colAL(0.02)).toBe("Hold");
    expect(colAL(0.05)).toBe("Hold");
    expect(colAL(-0.05)).toBe("Hold");
  });

  test("colAM", () => {
    expect(colAM(75)).toBe("Consider Exit");
    expect(colAM(25)).toBe("Consider Entry");
    expect(colAM(50)).toBe("Hold");
    expect(colAM(70)).toBe("Hold");
    expect(colAM(30)).toBe("Hold");
    expect(colAM(null)).toBe("Loading…");
  });

  test("colAU", () => {
    expect(colAU(35)).toBe(0.0075);
    expect(colAU(40)).toBe(0.0075);
    expect(colAU(41)).toBe(0.0025);
    expect(colAU(50)).toBe(0.0025);
    expect(colAU(51)).toBe(0.0015);
    expect(colAU(55)).toBe(0.0015);
    expect(colAU(56)).toBe(0);
    expect(colAU(100)).toBe(0);
  });

  test("colAR", () => {
    expect(colAR(0.0075, 516823.47)).toBeCloseTo(3876.176025, 4);
  });

  test("colAS", () => {
    expect(colAS(3876.18, 40385.11)).toBeCloseTo(-36508.93, 4);
  });

  test("colAT", () => {
    // AT = parity change $ / price = -36508.93 / 67.63 = -539.834 (2dp)
    expect(colAT(-36508.93, 67.63)).toBeCloseTo(-539.834, 2);
  });

  test("colAB — full precision from workbook basis prices (VEA row 4)", () => {
    const price = 48.13;
    const r3mo = colV(price, 46.59476744);
    const r6mo = colW(price, 44.60835227);
    const r1yr = colX(price, 41.20253687);
    const r3yr = colY(price, 37.78975146);
    const r5yr = colZ(price, 34.27219953);
    const result = colAB(r3mo, r6mo, r1yr, r3yr, r5yr, DEFAULT_ASSUMPTIONS.return_weights);
    expect(result).toBeCloseTo(0.1141221499, 4);
    // PRECISION NOTE: basis prices from Yahoo Finance may differ from
    // GOOGLEFINANCE due to vendor adjustment/holiday handling; acceptable
    // delta for this system is within 0.5%.
  });

  test("computeRSI", () => {
    expect(computeRSI([])).toBe(null);
    expect(computeRSI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])).toBe(null);

    const upOnly = computeRSI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(upOnly).not.toBeNull();
    expect(upOnly!).toBeGreaterThan(90);

    const downOnly = computeRSI([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(downOnly).not.toBeNull();
    expect(downOnly!).toBeLessThan(10);

    const mixed = [100, 102, 101, 103, 102, 104, 103, 105, 104, 106, 105, 107, 106, 108, 107];
    const mixedResult = computeRSI(mixed);
    expect(mixedResult).not.toBeNull();
    expect(mixedResult!).toBeGreaterThanOrEqual(0);
    expect(mixedResult!).toBeLessThanOrEqual(100);
  });

  test("denseRank", () => {
    const desc = denseRank([30, 10, 20], false);
    expect(desc.get(30)).toBe(1);
    expect(desc.get(20)).toBe(2);
    expect(desc.get(10)).toBe(3);

    const asc = denseRank([10, 20, 30], true);
    expect(asc.get(10)).toBe(1);
    expect(asc.get(20)).toBe(2);
    expect(asc.get(30)).toBe(3);

    const withNull = denseRank([10, null, 20], false);
    expect(withNull.get(20)).toBe(1);
    expect(withNull.get(10)).toBe(2);
    expect(withNull.has(null as never)).toBe(false);

    const ties = denseRank([10, 10, 20], false);
    expect(ties.get(20)).toBe(1);
    expect(ties.get(10)).toBe(2);
  });

  test("computePortfolioRanks", () => {
    const rows: Array<{
      rowStatus: string;
      currentWeight: number;
      expenseRatio: number;
      returnWeightedAvg: number;
      divApy: number;
      volatilityAbs: number;
      volatilitySigned: number;
      compositeScore: number | null;
      rank_overall: number | null;
      subRankExpense?: number | null;
    }> = [
      {
        rowStatus: "Active",
        currentWeight: 0.1,
        expenseRatio: 0.001,
        returnWeightedAvg: 0.12,
        divApy: 0.02,
        volatilityAbs: 0.001,
        volatilitySigned: 0.001,
        compositeScore: null,
        rank_overall: null,
      },
      {
        rowStatus: "Active",
        currentWeight: 0.2,
        expenseRatio: 0.002,
        returnWeightedAvg: 0.08,
        divApy: 0.03,
        volatilityAbs: 0.002,
        volatilitySigned: 0.002,
        compositeScore: null,
        rank_overall: null,
      },
      {
        rowStatus: "Active",
        currentWeight: 0.3,
        expenseRatio: 0.003,
        returnWeightedAvg: 0.15,
        divApy: 0.01,
        volatilityAbs: 0.003,
        volatilitySigned: 0.003,
        compositeScore: null,
        rank_overall: null,
      },
      {
        rowStatus: "Comparable",
        currentWeight: 0.99,
        expenseRatio: 0.999,
        returnWeightedAvg: 0.99,
        divApy: 0.99,
        volatilityAbs: 0.99,
        volatilitySigned: 0.99,
        compositeScore: null,
        rank_overall: null,
      },
    ];

    const ranked = computePortfolioRanks(rows, DEFAULT_ASSUMPTIONS);
    const active = ranked.filter((r) => r.rowStatus === "Active");
    const comparable = ranked.find((r) => r.rowStatus === "Comparable");

    expect(active).toHaveLength(3);
    active.forEach((row) => {
      expect(typeof row.compositeScore).toBe("number");
      expect(Number.isInteger(row.subRankExpense)).toBe(true);
      expect((row.subRankExpense ?? 0) >= 1 && (row.subRankExpense ?? 0) <= 3).toBe(true);
    });

    expect(comparable).toBeTruthy();
    expect(comparable?.compositeScore).toBe(null);
    expect(comparable?.rank_overall).toBe(null);
  });

  test("normaliseWeights", () => {
    const alreadyNormalised = normaliseWeights({
      r3mo: 0.4,
      r6mo: 0.25,
      r1yr: 0.2,
      r3yr: 0.1,
      r5yr: 0.05,
    });
    expect(alreadyNormalised.r3mo).toBeCloseTo(0.4, 4);
    expect(alreadyNormalised.r6mo).toBeCloseTo(0.25, 4);
    expect(alreadyNormalised.r1yr).toBeCloseTo(0.2, 4);
    expect(alreadyNormalised.r3yr).toBeCloseTo(0.1, 4);
    expect(alreadyNormalised.r5yr).toBeCloseTo(0.05, 4);

    const equal = normaliseWeights({
      r3mo: 2,
      r6mo: 2,
      r1yr: 2,
      r3yr: 2,
      r5yr: 2,
    });
    expect(equal.r3mo).toBeCloseTo(0.2, 4);
    expect(equal.r6mo).toBeCloseTo(0.2, 4);
    expect(equal.r1yr).toBeCloseTo(0.2, 4);
    expect(equal.r3yr).toBeCloseTo(0.2, 4);
    expect(equal.r5yr).toBeCloseTo(0.2, 4);

    const zero = normaliseWeights({
      r3mo: 0,
      r6mo: 0,
      r1yr: 0,
      r3yr: 0,
      r5yr: 0,
    });
    expect(zero).toEqual({
      r3mo: 0,
      r6mo: 0,
      r1yr: 0,
      r3yr: 0,
      r5yr: 0,
    });
  });
});
