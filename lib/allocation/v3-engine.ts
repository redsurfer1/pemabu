/**
 * Allocation Intelligence v3.2 Computation Engine
 *
 * All computation happens server-side. Pure functions — no side effects.
 * PERCENTRANK is computed across ALL active holdings simultaneously.
 * Sequence: fetch all prices -> compute all returns -> PERCENTRANK across full array
 * -> composite scores -> allocation pipeline (8 steps).
 */

import type {
  ComputedHolding,
  EngineAssumptions,
  HoldingInput,
  TrendSignal,
  VolCapFlag,
  HoldingStatus,
  Theme,
} from "@/types/allocation";

// ── Step 1: Period Returns ──────────────────────────────────────────

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

// ── Step 2: Blended Return ──────────────────────────────────────────

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

// ── Step 3: Volatility & Sharpe Proxy ──────────────────────────────

export function computeVolAndSharpe(
  ret3mo: number,
  blendedReturn: number,
): { vol: number; sharpe: number } {
  const vol = Math.abs(ret3mo / 90);
  const sharpe = blendedReturn / Math.max(vol, 0.0001);
  return { vol, sharpe };
}

// ── Step 4: PERCENTRANK (continuous, 0-1) ──────────────────────────
// Matches Excel PERCENTRANK: count(values < target) / (count - 1)
// Result clamped to [0, 1] — Excel returns #N/A for out-of-range values;
// clamping is safer and correct for all in-array targets.

export function percentRank(values: number[], target: number): number {
  if (values.length <= 1) return 0;
  const below = values.filter((v) => v < target).length;
  return Math.min(1, Math.max(0, below / (values.length - 1)));
}

// ── Step 5: Composite Score ─────────────────────────────────────────

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

// ── Trend Signal ────────────────────────────────────────────────────

export function computeTrendSignal(blendedReturn: number): TrendSignal {
  if (blendedReturn > 0.05) return "Consider Entry";
  if (blendedReturn < -0.05) return "Consider Exit";
  return "Hold";
}

// ── Full Engine: Compute All Holdings Simultaneously ────────────────
// Primary entry point. Processes ALL active holdings at once to ensure
// PERCENTRANK is computed across the full universe.

export interface ComputedMainSleeve {
  holdings: ComputedHolding[];
  totalValue: number;
  cappedCount: number;
}

export function computeMainSleeve(
  inputs: HoldingInput[],
  assumptions: EngineAssumptions,
  totalPortfolioNAV?: number,
): ComputedMainSleeve {
  const activeInputs = inputs.filter((h) => h.status === "Active");
  const comparableInputs = inputs.filter((h) => h.status === "Comparable");

  // Step 1-3: Returns, blended return, vol/sharpe for ALL active holdings
  const activeData = activeInputs.map((h) => {
    const returns = computeReturns(h);
    const blendedReturn = computeBlendedReturn(returns, assumptions);
    const { vol, sharpe } = computeVolAndSharpe(returns.ret3mo, blendedReturn);
    const value = h.qty * h.price;
    const divAPY = value > 0 ? h.divDollar / value : 0;
    return { input: h, returns, blendedReturn, vol, sharpe, value, divAPY };
  });

  // Step 4: PERCENTRANK — across ALL active holdings simultaneously
  const allExpenses = activeData.map((d) => d.input.expenseRatio);
  const allBlended = activeData.map((d) => d.blendedReturn);
  const allDivAPY = activeData.map((d) => d.divAPY);
  const allSharpe = activeData.map((d) => d.sharpe);

  const activeWithScores = activeData.map((d) => {
    const prExpense = 1 - percentRank(allExpenses, d.input.expenseRatio);
    const prReturn = percentRank(allBlended, d.blendedReturn);
    const prDivAPY = percentRank(allDivAPY, d.divAPY);
    const prSharpe = percentRank(allSharpe, d.sharpe);
    const compositeScore = computeCompositeScore(
      prExpense,
      prReturn,
      prDivAPY,
      prSharpe,
      assumptions,
    );
    return { ...d, prExpense, prReturn, prDivAPY, prSharpe, compositeScore };
  });

  // Step 6: Score rank (1 = highest)
  const sortedByScore = [...activeWithScores].sort(
    (a, b) => b.compositeScore - a.compositeScore,
  );
  const rankMap = new Map<string, number>();
  sortedByScore.forEach((d, i) => rankMap.set(d.input.id, i + 1));

  // Step 7: Allocation pipeline
  const totalScore = activeWithScores.reduce((s, d) => s + d.compositeScore, 0);
  const equalWtBase = activeWithScores.length > 0 ? 1 / activeWithScores.length : 0;
  const volCap = assumptions.volCapMultiplier * equalWtBase;

  // Pass 1: raw score weight + vol cap
  const pass1 = activeWithScores.map((d) => {
    const rawScoreWt = totalScore > 0 ? d.compositeScore / totalScore : equalWtBase;
    const cappedWt = Math.min(rawScoreWt, volCap);
    return { ...d, rawScoreWt, cappedWt };
  });

  // Pass 2: theme exposure per theme (using cappedWt from pass 1)
  const themeExposureMap = new Map<string, number>();
  for (const d of pass1) {
    themeExposureMap.set(
      d.input.theme,
      (themeExposureMap.get(d.input.theme) ?? 0) + d.cappedWt,
    );
  }

  // Pass 3: theme cap scaling -> themeCappedWt
  const pass3 = pass1.map((d) => {
    const themeExp = themeExposureMap.get(d.input.theme) ?? 0;
    const themeCappedWt =
      themeExp > assumptions.themeCapPct
        ? d.cappedWt * (assumptions.themeCapPct / themeExp)
        : d.cappedWt;
    return { ...d, themeExp, themeCappedWt };
  });

  // Normalize to (1 - incomeBudgetPct) = 88% of NAV
  const sumThemeCapped = pass3.reduce((s, d) => s + d.themeCappedWt, 0);
  const scaleFactor =
    sumThemeCapped > 0 ? (1 - assumptions.incomeBudgetPct) / sumThemeCapped : 0;

  // Step 8: Parity
  const activeTotalValue = activeWithScores.reduce((s, d) => s + d.value, 0);
  const navForParity = totalPortfolioNAV ?? activeTotalValue;

  let cappedCount = 0;
  const activeHoldings: ComputedHolding[] = pass3.map((d) => {
    const finalTargetWt = d.themeCappedWt * scaleFactor;
    const value = d.value;
    const currentWtPct = navForParity > 0 ? value / navForParity : 0;
    const targetWtPct = finalTargetWt;
    const parityGapPct = currentWtPct - targetWtPct;
    const parityDollarAmt = finalTargetWt * navForParity;
    const parityDollarChg = parityDollarAmt - value;
    const isCapped = d.rawScoreWt > volCap;
    if (isCapped) cappedCount++;

    return {
      id: d.input.id,
      ticker: d.input.ticker,
      name: d.input.name,
      status: "Active" as HoldingStatus,
      theme: d.input.theme as Theme,
      qty: d.input.qty,
      price: d.input.price,
      value,
      expenseRatio: d.input.expenseRatio,
      divDollar: d.input.divDollar,
      divAPY: d.divAPY,
      price3mo: d.input.price3mo,
      price6mo: d.input.price6mo,
      price1yr: d.input.price1yr,
      price3yr: d.input.price3yr,
      price5yr: d.input.price5yr,
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
      scoreRank: rankMap.get(d.input.id) ?? null,
      rawScoreWt: d.rawScoreWt,
      equalWtBase,
      volCapFlag: (isCapped ? "CAPPED" : "OK") as VolCapFlag,
      themeExposurePct: d.themeExp,
      themeCappedWt: d.themeCappedWt,
      finalTargetWt,
      parityDollarAmt,
      parityDollarChg,
      currentWtPct,
      targetWtPct,
      parityGapPct,
      trendSignal: computeTrendSignal(d.blendedReturn),
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
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      status: "Comparable" as HoldingStatus,
      theme: h.theme as Theme,
      qty: h.qty,
      price: h.price,
      value,
      expenseRatio: h.expenseRatio,
      divDollar: h.divDollar,
      divAPY,
      price3mo: h.price3mo,
      price6mo: h.price6mo,
      price1yr: h.price1yr,
      price3yr: h.price3yr,
      price5yr: h.price5yr,
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
      themeCappedWt: 0,
      finalTargetWt: 0,
      parityDollarAmt: 0,
      parityDollarChg: 0,
      currentWtPct: 0,
      targetWtPct: 0,
      parityGapPct: 0,
      trendSignal: computeTrendSignal(blendedReturn),
    };
  });

  return {
    holdings: [...activeHoldings, ...comparableHoldings],
    totalValue: activeTotalValue,
    cappedCount,
  };
}

// ── Income Sleeve: Yield-Proportional Weighting ─────────────────────

export interface IncomeHoldingInput {
  id: string;
  ticker: string;
  name: string;
  qty: number;
  price: number;
  divDollar: number;
  expenseRatio?: number;
}

export function computeIncomeSleeve(
  inputs: IncomeHoldingInput[],
  incomeBudgetPct: number,
  totalPortfolioNAV: number,
): ComputedHolding[] {
  const data = inputs.map((h) => {
    const value = h.qty * h.price;
    const divAPY = value > 0 ? h.divDollar / value : 0;
    return { ...h, value, divAPY };
  });

  const totalDivAPY = data.reduce((s, d) => s + d.divAPY, 0);

  return data.map((d) => {
    const finalTargetWt =
      totalDivAPY > 0 ? (d.divAPY / totalDivAPY) * incomeBudgetPct : 0;
    const currentWtPct = totalPortfolioNAV > 0 ? d.value / totalPortfolioNAV : 0;
    const targetWtPct = finalTargetWt;
    const parityGapPct = currentWtPct - targetWtPct;
    const parityDollarAmt = finalTargetWt * totalPortfolioNAV;
    const parityDollarChg = parityDollarAmt - d.value;

    return {
      id: d.id,
      ticker: d.ticker,
      name: d.name,
      status: "Active" as HoldingStatus,
      theme: "Dividend" as Theme,
      qty: d.qty,
      price: d.price,
      value: d.value,
      expenseRatio: d.expenseRatio ?? 0,
      divDollar: d.divDollar,
      divAPY: d.divAPY,
      price3mo: 0,
      price6mo: 0,
      price1yr: 0,
      price3yr: 0,
      price5yr: 0,
      ret3mo: 0,
      ret6mo: 0,
      ret1yr: 0,
      ret3yr: 0,
      ret5yr: 0,
      blendedReturn: 0,
      vol3mo: 0,
      sharpeProxy: 0,
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
      themeCappedWt: 0,
      finalTargetWt,
      parityDollarAmt,
      parityDollarChg,
      currentWtPct,
      targetWtPct,
      parityGapPct,
      trendSignal: "Hold" as TrendSignal,
    };
  });
}
