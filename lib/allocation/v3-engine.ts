/**
 * Allocation Intelligence v3.2 Computation Engine
 *
 * All computation happens server-side. Pure functions — no side effects.
 * PERCENTRANK is computed across ALL active holdings simultaneously.
 * Sequence: fetch all prices -> compute all returns -> PERCENTRANK across full array -> composite scores.
 */

import type {
  ComputedHolding,
  EngineAssumptions,
  HoldingInput,
  IncomeHoldingInput,
  TrendSignal,
  VolCapFlag,
  HoldingStatus,
} from "@/types/allocation";

export type { IncomeHoldingInput } from "@/types/allocation";

// ── Step 1: Period Returns ──────────────────────────────────────

export interface HoldingReturns {
  ret3mo: number;
  ret6mo: number;
  ret1yr: number;
  ret3yr: number;
  ret5yr: number;
}

export function computeReturns(h: HoldingInput): HoldingReturns {
  const ret3mo = h.price3mo > 0 ? (h.price - h.price3mo) / h.price3mo : 0;
  const ret6mo = h.price6mo > 0 ? (h.price - h.price6mo) / h.price6mo : 0;
  const ret1yr = h.price1yr > 0 ? (h.price - h.price1yr) / h.price1yr : 0;
  const ret3yr = h.price3yr > 0 ? (h.price - h.price3yr) / h.price3yr : 0;
  const ret5yr = h.price5yr > 0 ? (h.price - h.price5yr) / h.price5yr : 0;
  return { ret3mo, ret6mo, ret1yr, ret3yr, ret5yr };
}

// ── Step 2: Blended Return ──────────────────────────────────────

export function computeBlendedReturn(
  returns: HoldingReturns,
  assumptions: EngineAssumptions,
): number {
  return (
    returns.ret3mo * assumptions.retWeight3mo +
    returns.ret6mo * assumptions.retWeight6mo +
    returns.ret1yr * assumptions.retWeight1yr +
    returns.ret3yr * assumptions.retWeight3yr +
    returns.ret5yr * assumptions.retWeight5yr
  );
}

// ── Step 3: Volatility & Sharpe Proxy ───────────────────────────

export function computeVolAndSharpe(
  ret3mo: number,
  blendedReturn: number,
): { vol: number; sharpe: number } {
  const vol = Math.abs(ret3mo / 90);
  const sharpe = blendedReturn / Math.max(vol, 0.0001);
  return { vol, sharpe };
}

// ── Step 4: PERCENTRANK (continuous, 0-1) ───────────────────────
// Computed across the full active universe for each factor.
// Formula matches Excel PERCENTRANK: count(values < target) / (count - 1)

export function percentRank(values: number[], target: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < target).length;
  const total = sorted.length - 1;
  return total > 0 ? below / total : 0;
}

// ── Step 5: Composite Score ─────────────────────────────────────

export function computeCompositeScore(
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

// ── Step 6: Score-Proportional Allocation ───────────────────────

export function computeTargetWeights(
  activeHoldings: Array<{ ticker: string; theme: string; compositeScore: number }>,
  assumptions: EngineAssumptions,
): Map<string, number> {
  const totalScore = activeHoldings.reduce((sum, h) => sum + h.compositeScore, 0);
  const equalWeight = 1 / activeHoldings.length;
  const volCap = assumptions.volCapMultiplier * equalWeight;

  const rawWeights = new Map(
    activeHoldings.map((h) => [
      h.ticker,
      totalScore > 0 ? h.compositeScore / totalScore : equalWeight,
    ]),
  );

  // Vol cap: cap any position exceeding N x equal weight
  const cappedWeights = new Map(
    [...rawWeights].map(([t, w]) => [t, Math.min(w, volCap)]),
  );

  // Theme cap: if a theme's total exposure exceeds themeCapPct, scale down proportionally
  const themeExposure = new Map<string, number>();
  activeHoldings.forEach((h) => {
    const w = cappedWeights.get(h.ticker) ?? 0;
    themeExposure.set(h.theme, (themeExposure.get(h.theme) ?? 0) + w);
  });

  const themeCapped = new Map(
    activeHoldings.map((h) => {
      const w = cappedWeights.get(h.ticker) ?? 0;
      const exp = themeExposure.get(h.theme) ?? 0;
      const adj = exp > assumptions.themeCapPct ? w * (assumptions.themeCapPct / exp) : w;
      return [h.ticker, adj] as [string, number];
    }),
  );

  // Normalize to (1 - incomeBudgetPct) = 88% of NAV
  const sumCapped = [...themeCapped.values()].reduce((s, v) => s + v, 0);
  const scaleFactor = sumCapped > 0 ? (1 - assumptions.incomeBudgetPct) / sumCapped : 0;

  return new Map([...themeCapped].map(([t, w]) => [t, w * scaleFactor]));
}

// ── Trend Signal ────────────────────────────────────────────────

export function computeTrendSignal(blendedReturn: number): TrendSignal {
  if (blendedReturn > 0.05) return "Consider Entry";
  if (blendedReturn < -0.05) return "Consider Exit";
  return "Hold";
}

// ── Full Engine: Compute All Holdings Simultaneously ────────────
// This is the primary entry point. It processes ALL active holdings
// at once to ensure PERCENTRANK is computed across the full universe.

export interface ComputedMainSleeve {
  holdings: ComputedHolding[];
  totalValue: number;
  cappedCount: number;
}

export function computeMainSleeve(
  inputs: HoldingInput[],
  assumptions: EngineAssumptions,
): ComputedMainSleeve {
  // Separate active from comparable
  const activeInputs = inputs.filter((h) => h.status === "Active");
  const comparableInputs = inputs.filter((h) => h.status === "Comparable");

  // Step 1 & 2: Compute returns and blended return for ALL active holdings
  const activeData = activeInputs.map((h) => {
    const returns = computeReturns(h);
    const blendedReturn = computeBlendedReturn(returns, assumptions);
    const { vol, sharpe } = computeVolAndSharpe(returns.ret3mo, blendedReturn);
    const value = h.qty * h.price;
    const divAPY = value > 0 ? h.divDollar / value : 0;
    return { input: h, returns, blendedReturn, vol, sharpe, value, divAPY };
  });

  // Step 4: PERCENTRANK — computed across ALL active holdings simultaneously
  const allExpenses = activeData.map((d) => d.input.expenseRatio);
  const allBlended = activeData.map((d) => d.blendedReturn);
  const allDivAPY = activeData.map((d) => d.divAPY);
  const allSharpe = activeData.map((d) => d.sharpe);

  const activeWithScores = activeData.map((d) => {
    // For expense: lower is better, so use 1 - percentRank
    const prExpense = 1 - percentRank(allExpenses, d.input.expenseRatio);
    const prReturn = percentRank(allBlended, d.blendedReturn);
    const prDivAPY = percentRank(allDivAPY, d.divAPY);
    const prSharpe = percentRank(allSharpe, d.sharpe);

    // Step 5: Composite score
    const compositeScore = computeCompositeScore(
      prExpense,
      prReturn,
      prDivAPY,
      prSharpe,
      assumptions,
    );

    return { ...d, prExpense, prReturn, prDivAPY, prSharpe, compositeScore };
  });

  // Step 5b: Rank by composite score (1 = highest)
  const sortedByScore = [...activeWithScores].sort(
    (a, b) => b.compositeScore - a.compositeScore,
  );
  const rankMap = new Map<string, number>();
  sortedByScore.forEach((d, i) => rankMap.set(d.input.ticker, i + 1));

  // Step 6: Target weights
  const targetWeights = computeTargetWeights(
    activeWithScores.map((d) => ({
      ticker: d.input.ticker,
      theme: d.input.theme,
      compositeScore: d.compositeScore,
    })),
    assumptions,
  );

  // Compute theme exposures for display
  const themeExposureMap = new Map<string, number>();
  activeWithScores.forEach((d) => {
    const w = targetWeights.get(d.input.ticker) ?? 0;
    themeExposureMap.set(
      d.input.theme,
      (themeExposureMap.get(d.input.theme) ?? 0) + w,
    );
  });

  const totalValue = activeWithScores.reduce((s, d) => s + d.value, 0);
  const equalWeight = activeWithScores.length > 0 ? 1 / activeWithScores.length : 0;
  const volCap = assumptions.volCapMultiplier * equalWeight;

  // Build computed holdings
  let cappedCount = 0;
  const activeHoldings: ComputedHolding[] = activeWithScores.map((d) => {
    const targetWt = targetWeights.get(d.input.ticker) ?? 0;
    const currentWtPct = totalValue > 0 ? d.value / totalValue : 0;
    const targetDollar = targetWt * totalValue;
    const parityDollarChg = targetDollar - d.value;
    const parityGapPct = targetWt > 0 ? (d.value - targetDollar) / targetDollar : 0;

    const rawWt =
      activeWithScores.reduce((s, x) => s + x.compositeScore, 0) > 0
        ? d.compositeScore /
          activeWithScores.reduce((s, x) => s + x.compositeScore, 0)
        : equalWeight;
    const isCapped = rawWt > volCap;
    if (isCapped) cappedCount++;

    const volCapFlag: VolCapFlag = isCapped ? "CAPPED" : "OK";
    const themeExp = themeExposureMap.get(d.input.theme) ?? 0;
    const trendSignal = computeTrendSignal(d.blendedReturn);

    return {
      ticker: d.input.ticker,
      name: d.input.ticker,
      status: "Active" as HoldingStatus,
      theme: d.input.theme as ComputedHolding["theme"],
      qty: d.input.qty,
      price: d.input.price,
      value: d.value,
      expenseRatio: d.input.expenseRatio,
      divDollar: d.input.divDollar,
      divAPY: d.divAPY,
      currentWtPct,
      targetWtPct: targetWt,
      parityGapPct,
      parityDollarChg,
      ret3mo: d.returns.ret3mo,
      ret6mo: d.returns.ret6mo,
      ret1yr: d.returns.ret1yr,
      ret3yr: d.returns.ret3yr,
      ret5yr: d.returns.ret5yr,
      blendedReturn: d.blendedReturn,
      vol3mo: d.vol,
      sharpeProxy: d.sharpe,
      prExpense: d.prExpense,
      prReturn: d.prReturn,
      prDivAPY: d.prDivAPY,
      prSharpe: d.prSharpe,
      compositeScore: d.compositeScore,
      scoreRank: rankMap.get(d.input.ticker) ?? null,
      rawScoreWt: rawWt,
      equalWtBase: equalWeight,
      volCapFlag,
      themeExposurePct: themeExp,
      trendSignal,
    };
  });

  // Comparable holdings (display-only, no scoring)
  const comparableHoldings: ComputedHolding[] = comparableInputs.map((h) => {
    const returns = computeReturns(h);
    const blendedReturn = computeBlendedReturn(returns, assumptions);
    const { vol, sharpe } = computeVolAndSharpe(returns.ret3mo, blendedReturn);
    const value = h.qty * h.price;
    const divAPY = value > 0 ? h.divDollar / value : 0;

    return {
      ticker: h.ticker,
      name: h.ticker,
      status: "Comparable" as HoldingStatus,
      theme: h.theme as ComputedHolding["theme"],
      qty: h.qty,
      price: h.price,
      value,
      expenseRatio: h.expenseRatio,
      divDollar: h.divDollar,
      divAPY,
      currentWtPct: 0,
      targetWtPct: 0,
      parityGapPct: 0,
      parityDollarChg: 0,
      ret3mo: returns.ret3mo,
      ret6mo: returns.ret6mo,
      ret1yr: returns.ret1yr,
      ret3yr: returns.ret3yr,
      ret5yr: returns.ret5yr,
      blendedReturn,
      vol3mo: vol,
      sharpeProxy: sharpe,
      prExpense: 0,
      prReturn: 0,
      prDivAPY: 0,
      prSharpe: 0,
      compositeScore: 0,
      scoreRank: null,
      rawScoreWt: 0,
      equalWtBase: 0,
      volCapFlag: "N/A" as VolCapFlag,
      themeExposurePct: 0,
      trendSignal: computeTrendSignal(blendedReturn),
    };
  });

  return {
    holdings: [...activeHoldings, ...comparableHoldings],
    totalValue,
    cappedCount,
  };
}

// ── Income Sleeve: Yield-Proportional Weighting ─────────────────

export interface ComputedIncomeHolding {
  id?: string;
  ticker: string;
  name: string;
  qty: number;
  price: number;
  value: number;
  divAPY: number;
  currentWtPct: number;
  targetWtPct: number;
  parityGapPct: number;
  parityDollarChg: number;
  parityDollarAmt: number;
  finalTargetWt: number;
}

export function computeIncomeSleeve(
  inputs: IncomeHoldingInput[],
  incomeBudgetPct: number,
  totalPortfolioNAV: number,
): ComputedIncomeHolding[] {
  const data = inputs.map((h) => {
    const value = h.qty * h.price;
    const divAPY = value > 0 ? h.divDollar / value : 0;
    return { ...h, value, divAPY };
  });

  const totalDivAPY = data.reduce((s, d) => s + d.divAPY, 0);
  const sleeveValue = data.reduce((s, d) => s + d.value, 0);

  return data.map((d) => {
    const targetWtPct =
      totalDivAPY > 0 ? (d.divAPY / totalDivAPY) * incomeBudgetPct : 0;
    const currentWtPct = sleeveValue > 0 ? d.value / sleeveValue : 0;
    const targetDollar = targetWtPct * totalPortfolioNAV;
    const parityDollarChg = targetDollar - d.value;
    const parityDollarAmt = targetDollar;
    const finalTargetWt = targetWtPct;
    const parityGapPct =
      totalPortfolioNAV > 0 ? d.value / totalPortfolioNAV - targetWtPct : 0;

    return {
      id: d.id,
      ticker: d.ticker,
      name: d.name,
      qty: d.qty,
      price: d.price,
      value: d.value,
      divAPY: d.divAPY,
      currentWtPct,
      targetWtPct,
      parityGapPct,
      parityDollarChg,
      parityDollarAmt,
      finalTargetWt,
    };
  });
}
