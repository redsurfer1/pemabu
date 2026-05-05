/**
 * Allocation Intelligence v3.2 — pure computation (no I/O).
 * Aligns with spreadsheet: period returns → blended → vol/sharpe → PERCENTRANK →
 * composite → rank → vol cap + theme cap → normalize to (1 − income%) → parity.
 */

import type {
  AllocationEngineHolding,
  ComputedHolding,
  CurrentPrices,
  EngineAssumptions,
  HoldingInput,
  HistoricalPrices,
  HoldingStatus,
  IncomeHoldingInput,
  TrendSignal,
  VolCapFlag,
} from "@/types/allocation";

export type { CurrentPrices, IncomeHoldingInput } from "@/types/allocation";

function trendToBlended(br: number): TrendSignal {
  if (br > 0.05) return "Consider Entry";
  if (br < -0.05) return "Consider Exit";
  return "Hold";
}

function normalizeTicker(t: string): string {
  return t.trim().toUpperCase();
}

// ── Step 1–3 helpers ──────────────────────────────────────────────

export interface HoldingReturns {
  ret3mo: number;
  ret6mo: number;
  ret1yr: number;
  ret3yr: number;
  ret5yr: number;
}

export function computeReturns(price: number, h: HoldingInput): HoldingReturns {
  const ret3mo = h.price3mo > 0 ? (price - h.price3mo) / h.price3mo : 0;
  const ret6mo = h.price6mo > 0 ? (price - h.price6mo) / h.price6mo : 0;
  const ret1yr = h.price1yr > 0 ? (price - h.price1yr) / h.price1yr : 0;
  const ret3yr = h.price3yr > 0 ? (price - h.price3yr) / h.price3yr : 0;
  const ret5yr = h.price5yr > 0 ? (price - h.price5yr) / h.price5yr : 0;
  return { ret3mo, ret6mo, ret1yr, ret3yr, ret5yr };
}

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

export function computeVolAndSharpe(
  ret3mo: number,
  blendedReturn: number,
): { vol3mo: number; sharpeProxy: number } {
  const vol3mo = Math.abs(ret3mo / 90);
  const sharpeProxy = blendedReturn / Math.max(vol3mo, 0.0001);
  return { vol3mo, sharpeProxy };
}

/** Excel PERCENTRANK (continuous): count(values < target) / (n − 1) */
export function percentRank(values: number[], target: number): number {
  if (values.length <= 1) return 0;
  const below = values.filter((v) => v < target).length;
  return below / (values.length - 1);
}

function computeCompositeScore(
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

// ── Merge market data ────────────────────────────────────────────

function mergeHistorical(
  ticker: string,
  hp: HistoricalPrices,
): Pick<
  HoldingInput,
  "price3mo" | "price6mo" | "price1yr" | "price3yr" | "price5yr"
> {
  const u = ticker.toUpperCase();
  const row =
    hp[ticker] ?? hp[u] ?? (hp as Record<string, HistoricalPrices[string]>)[ticker] ?? {};
  return {
    price3mo: row["3mo"] ?? 0,
    price6mo: row["6mo"] ?? 0,
    price1yr: row["1yr"] ?? 0,
    price3yr: row["3yr"] ?? 0,
    price5yr: row["5yr"] ?? 0,
  };
}

function toHoldingInput(
  h: AllocationEngineHolding,
  price: number,
  hp: HistoricalPrices,
): HoldingInput {
  const hist = mergeHistorical(normalizeTicker(h.ticker), hp);
  return {
    ticker: h.ticker,
    status: h.status,
    theme: h.theme,
    qty: h.qty,
    price,
    expenseRatio: h.expenseRatio,
    divDollar: h.divDollar,
    ...hist,
  };
}

// ── Main sleeve pipeline ─────────────────────────────────────────

export interface ComputedMainSleeve {
  holdings: ComputedHolding[];
  totalValue: number;
  cappedCount: number;
}

export function computeMainSleeve(
  inputs: HoldingInput[],
  assumptions: EngineAssumptions,
  totalNAV: number,
): ComputedMainSleeve {
  const activeInputs = inputs.filter((h) => h.status === "Active");
  const comparableInputs = inputs.filter((h) => h.status === "Comparable");

  const activeData = activeInputs.map((h) => {
    const returns = computeReturns(h.price, h);
    const blendedReturn = computeBlendedReturn(returns, assumptions);
    const { vol3mo, sharpeProxy } = computeVolAndSharpe(returns.ret3mo, blendedReturn);
    const value = h.qty * h.price;
    const divAPY = value > 0 ? h.divDollar / value : 0;
    return { input: h, returns, blendedReturn, vol3mo, sharpeProxy, value, divAPY };
  });

  const allExpenses = activeData.map((d) => d.input.expenseRatio);
  const allBlended = activeData.map((d) => d.blendedReturn);
  const allDivAPY = activeData.map((d) => d.divAPY);
  const allSharpe = activeData.map((d) => d.sharpeProxy);

  const activeWithScores = activeData.map((d) => {
    const prExpense = 1 - percentRank(allExpenses, d.input.expenseRatio);
    const prReturn = percentRank(allBlended, d.blendedReturn);
    const prDivAPY = percentRank(allDivAPY, d.divAPY);
    const prSharpe = percentRank(allSharpe, d.sharpeProxy);
    const compositeScore = computeCompositeScore(
      prExpense,
      prReturn,
      prDivAPY,
      prSharpe,
      assumptions,
    );
    return {
      ...d,
      prExpense,
      prReturn,
      prDivAPY,
      prSharpe,
      compositeScore,
    };
  });

  const sortedByScore = [...activeWithScores].sort(
    (a, b) => b.compositeScore - a.compositeScore,
  );
  const rankMap = new Map<string, number>();
  sortedByScore.forEach((d, i) => {
    rankMap.set(d.input.ticker, i + 1);
  });

  const n = activeWithScores.length;
  const equalWtBase = n > 0 ? 1 / n : 0;
  const volCap = assumptions.volCapMultiplier * equalWtBase;
  const sumComposite = activeWithScores.reduce((s, d) => s + d.compositeScore, 0);

  const rawScoreWts = activeWithScores.map((d) =>
    sumComposite > 0 ? d.compositeScore / sumComposite : equalWtBase,
  );

  const cappedWts = rawScoreWts.map((rw) => Math.min(rw, volCap));

  const themeExposurePass1 = new Map<string, number>();
  activeWithScores.forEach((d, i) => {
    const t = d.input.theme;
    themeExposurePass1.set(t, (themeExposurePass1.get(t) ?? 0) + cappedWts[i]!);
  });

  const themeCappedWts = activeWithScores.map((d, i) => {
    const theme = d.input.theme;
    const exposure = themeExposurePass1.get(theme) ?? 0;
    const base = Math.min(volCap, rawScoreWts[i]!);
    if (exposure > assumptions.themeCapPct) {
      return base * (assumptions.themeCapPct / exposure);
    }
    return base;
  });

  const sumThemeCapped = themeCappedWts.reduce((s, v) => s + v, 0);
  const scaleMain =
    sumThemeCapped > 0 ? (1 - assumptions.incomeBudgetPct) / sumThemeCapped : 0;

  const finalTargetWts = themeCappedWts.map((w) => w * scaleMain);

  const totalValue = activeWithScores.reduce((s, d) => s + d.value, 0);
  let cappedCount = 0;

  const activeHoldings: ComputedHolding[] = activeWithScores.map((d, i) => {
    const rawWt = rawScoreWts[i]!;
    const isCapped = rawWt > volCap;
    if (isCapped) cappedCount++;

    const volCapFlag: VolCapFlag = isCapped ? "CAPPED" : "OK";
    const themeExposurePct = themeExposurePass1.get(d.input.theme) ?? 0;
    const themeCappedWt = themeCappedWts[i]!;
    const finalTargetWt = finalTargetWts[i]!;
    const currentWtPct = totalNAV > 0 ? d.value / totalNAV : 0;
    const parityDollarAmt = finalTargetWt * totalNAV;
    const parityDollarChg = parityDollarAmt - d.value;
    const parityGapPct = currentWtPct - finalTargetWt;

    return {
      id: undefined,
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
      targetWtPct: finalTargetWt,
      parityGapPct,
      parityDollarChg,
      parityDollarAmt,
      ret3mo: d.returns.ret3mo,
      ret6mo: d.returns.ret6mo,
      ret1yr: d.returns.ret1yr,
      ret3yr: d.returns.ret3yr,
      ret5yr: d.returns.ret5yr,
      blendedReturn: d.blendedReturn,
      vol3mo: d.vol3mo,
      sharpeProxy: d.sharpeProxy,
      prExpense: d.prExpense,
      prReturn: d.prReturn,
      prDivAPY: d.prDivAPY,
      prSharpe: d.prSharpe,
      compositeScore: d.compositeScore,
      scoreRank: rankMap.get(d.input.ticker) ?? null,
      rawScoreWt: rawWt,
      equalWtBase,
      volCapFlag,
      themeExposurePct,
      themeCappedWt,
      trendSignal: trendToBlended(d.blendedReturn),
      price3mo: d.input.price3mo,
      price6mo: d.input.price6mo,
      price1yr: d.input.price1yr,
      price3yr: d.input.price3yr,
      price5yr: d.input.price5yr,
    };
  });

  const comparableHoldings: ComputedHolding[] = comparableInputs.map((h) => {
    const returns = computeReturns(h.price, h);
    const blendedReturn = computeBlendedReturn(returns, assumptions);
    const { vol3mo, sharpeProxy } = computeVolAndSharpe(returns.ret3mo, blendedReturn);
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
      currentWtPct: totalNAV > 0 ? value / totalNAV : 0,
      targetWtPct: 0,
      parityGapPct: 0,
      parityDollarChg: 0,
      parityDollarAmt: 0,
      ret3mo: returns.ret3mo,
      ret6mo: returns.ret6mo,
      ret1yr: returns.ret1yr,
      ret3yr: returns.ret3yr,
      ret5yr: returns.ret5yr,
      blendedReturn,
      vol3mo,
      sharpeProxy,
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
      trendSignal: trendToBlended(blendedReturn),
      price3mo: h.price3mo,
      price6mo: h.price6mo,
      price1yr: h.price1yr,
      price3yr: h.price3yr,
      price5yr: h.price5yr,
    };
  });

  return {
    holdings: [...activeHoldings, ...comparableHoldings],
    totalValue,
    cappedCount,
  };
}

// ── Income sleeve ────────────────────────────────────────────────

export interface ComputedIncomeHolding {
  ticker: string;
  name: string;
  qty: number;
  price: number;
  value: number;
  divAPY: number;
  currentWtPct: number;
  targetWtPct: number;
  parityDollarChg: number;
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

    return {
      ticker: d.ticker,
      name: d.name,
      qty: d.qty,
      price: d.price,
      value: d.value,
      divAPY: d.divAPY,
      currentWtPct,
      targetWtPct,
      parityDollarChg,
    };
  });
}

// ── Manual / Fidelity sleeve ─────────────────────────────────────

function computeManualHolding(
  h: AllocationEngineHolding,
  price: number,
  totalNAV: number,
): ComputedHolding {
  const value = h.qty * price;
  const targetWt = h.manualTargetWt ?? 0;
  const currentWtPct = totalNAV > 0 ? value / totalNAV : 0;
  const parityDollarAmt = targetWt * totalNAV;
  const parityDollarChg = parityDollarAmt - value;
  const divAPY = value > 0 ? h.divDollar / value : 0;

  return {
    ticker: h.ticker,
    name: h.name,
    status: "Active",
    theme: (h.theme as ComputedHolding["theme"]) ?? "Broad",
    qty: h.qty,
    price,
    value,
    expenseRatio: h.expenseRatio,
    divDollar: h.divDollar,
    divAPY,
    currentWtPct,
    targetWtPct: targetWt,
    parityGapPct: currentWtPct - targetWt,
    parityDollarChg,
    parityDollarAmt,
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
    volCapFlag: "N/A",
    themeExposurePct: 0,
    themeCappedWt: 0,
    trendSignal: "Hold",
    price3mo: 0,
    price6mo: 0,
    price1yr: 0,
    price3yr: 0,
    price5yr: 0,
  };
}

// ── Unified entry ─────────────────────────────────────────────────

export function computePortfolioAllocations(
  holdings: AllocationEngineHolding[],
  historicalPrices: HistoricalPrices,
  currentPrices: CurrentPrices,
  assumptions: EngineAssumptions,
  totalNAV: number,
): ComputedHolding[] {
  const mainRows: AllocationEngineHolding[] = [];
  const incomeRows: AllocationEngineHolding[] = [];
  const manualRows: AllocationEngineHolding[] = [];

  for (const h of holdings) {
    if (h.sleeveRole === "MAIN") mainRows.push(h);
    else if (h.sleeveRole === "INCOME") incomeRows.push(h);
    else manualRows.push(h);
  }

  const result: ComputedHolding[] = [];

  if (mainRows.length > 0) {
    const mainInputs: HoldingInput[] = mainRows.map((h) => {
      const t = normalizeTicker(h.ticker);
      const price =
        h.manualPricing === true ? h.price : (currentPrices[t] ?? h.price);
      return toHoldingInput(h, price, historicalPrices);
    });
    const main = computeMainSleeve(mainInputs, assumptions, totalNAV);
    const idByTicker = new Map(mainRows.map((r) => [normalizeTicker(r.ticker), r.id]));
    for (const row of main.holdings) {
      result.push({
        ...row,
        name: mainRows.find((m) => normalizeTicker(m.ticker) === normalizeTicker(row.ticker))?.name ?? row.name,
        id: idByTicker.get(normalizeTicker(row.ticker)),
      });
    }
  }

  if (incomeRows.length > 0) {
    const incInputs: IncomeHoldingInput[] = incomeRows.map((h) => {
      const t = normalizeTicker(h.ticker);
      const price =
        h.manualPricing === true ? h.price : (currentPrices[t] ?? h.price);
      return {
        id: h.id,
        ticker: h.ticker,
        name: h.name,
        qty: h.qty,
        price,
        divDollar: h.divDollar,
      };
    });
    const inc = computeIncomeSleeve(incInputs, assumptions.incomeBudgetPct, totalNAV);
    for (let i = 0; i < inc.length; i++) {
      const row = inc[i]!;
      const src = incomeRows[i]!;
      const price = src.manualPricing === true ? src.price : (currentPrices[normalizeTicker(src.ticker)] ?? src.price);
      result.push({
        ticker: row.ticker,
        name: row.name,
        status: "Active",
        theme: src.theme as ComputedHolding["theme"],
        qty: row.qty,
        price,
        value: row.value,
        expenseRatio: src.expenseRatio,
        divDollar: src.divDollar,
        divAPY: row.divAPY,
        currentWtPct: totalNAV > 0 ? row.value / totalNAV : 0,
        targetWtPct: row.targetWtPct,
        parityGapPct:
          totalNAV > 0 ? row.value / totalNAV - row.targetWtPct : 0,
        parityDollarChg: row.parityDollarChg,
        parityDollarAmt: row.targetWtPct * totalNAV,
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
        volCapFlag: "N/A",
        themeExposurePct: 0,
        themeCappedWt: 0,
        trendSignal: "Hold",
        price3mo: 0,
        price6mo: 0,
        price1yr: 0,
        price3yr: 0,
        price5yr: 0,
        id: src.id,
      });
    }
  }

  for (const h of manualRows) {
    const t = normalizeTicker(h.ticker);
    const price = h.manualPricing === true ? h.price : (currentPrices[t] ?? h.price);
    result.push({
      ...computeManualHolding(h, price, totalNAV),
      id: h.id,
      name: h.name,
    });
  }

  return result;
}
