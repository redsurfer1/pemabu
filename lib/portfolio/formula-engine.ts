import {
  DEFAULT_FACTOR_WEIGHTS,
  type FactorSubRanks,
  type FactorWeights,
  normaliseFactorWeights,
} from "@/lib/portfolio/portfolio-factors";

export type { FactorWeights, FactorWeightKey, FactorSubRanks } from "@/lib/portfolio/portfolio-factors";
export { DEFAULT_FACTOR_WEIGHTS, FACTOR_LABELS, normaliseFactorWeights } from "@/lib/portfolio/portfolio-factors";

export interface Assumptions {
  return_weights: { r3mo: number; r6mo: number; r1yr: number; r3yr: number; r5yr: number };
  factor_weights: FactorWeights;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  return_weights: { r3mo: 0.4, r6mo: 0.25, r1yr: 0.2, r3yr: 0.1, r5yr: 0.05 },
  factor_weights: { ...DEFAULT_FACTOR_WEIGHTS },
};

function safeDiv(n: number, d: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return n / d;
}

function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return 0;
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

export function colD(marketValue: number, totalMV: number): number {
  return round(safeDiv(marketValue, totalMV));
}

export function colH(dividendDollars: number, marketValue: number): number {
  return round(safeDiv(dividendDollars, marketValue));
}

export function colJ(quantity: number, price: number): number {
  return round((Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(price) ? price : 0), 4);
}

export function colO(price1: number, price2: number): number {
  return round(safeDiv(price1 - price2, price2));
}

export function colP(price1: number, price3: number): number {
  return round(safeDiv(price1 - price3, price3));
}

export function colV(price1: number, basis3mo: number): number {
  return round(safeDiv(price1 - basis3mo, basis3mo));
}
export function colW(price1: number, basis6mo: number): number {
  return round(safeDiv(price1 - basis6mo, basis6mo));
}
export function colX(price1: number, basis1yr: number): number {
  return round(safeDiv(price1 - basis1yr, basis1yr));
}
export function colY(price1: number, basis3yr: number): number {
  return round(safeDiv(price1 - basis3yr, basis3yr));
}
export function colZ(price1: number, basis5yr: number): number {
  return round(safeDiv(price1 - basis5yr, basis5yr));
}

export function colAA(returns: number[]): number {
  const values = returns.filter((r) => Number.isFinite(r));
  if (values.length === 0) return 0;
  return round(values.reduce((s, r) => s + r, 0) / values.length);
}

export function colAB(
  r3mo: number,
  r6mo: number,
  r1yr: number,
  r3yr: number,
  r5yr: number,
  weights: Assumptions["return_weights"],
): number {
  return round(
    r3mo * weights.r3mo +
      r6mo * weights.r6mo +
      r1yr * weights.r1yr +
      r3yr * weights.r3yr +
      r5yr * weights.r5yr,
  );
}

export function colAC(return3mo: number): number {
  return round(Math.abs(return3mo / 90));
}

export function colAD(return3mo: number): number {
  return round(return3mo / 90);
}

export function colAKComposite(subRanks: FactorSubRanks, weights: FactorWeights): number {
  let sum = 0;
  for (const k of Object.keys(weights) as (keyof FactorWeights)[]) {
    sum += subRanks[k] * weights[k];
  }
  return round(sum, 4);
}

/** Weighted composite score from factor sub-ranks (legacy 4-arg + optional sovereign ranks). */
export function colAK(
  subRankExpense: number,
  subRankWeightedRet: number,
  subRankDivApy: number,
  subRankVolatility: number,
  weights: FactorWeights,
  extra?: Partial<FactorSubRanks>,
): number {
  const sub: FactorSubRanks = {
    expense: subRankExpense,
    pctWeight: extra?.pctWeight ?? 0,
    weightedReturn: subRankWeightedRet,
    divApy: subRankDivApy,
    volatility: subRankVolatility,
    thirteenF: extra?.thirteenF ?? 0,
    macroIntelligence: extra?.macroIntelligence ?? 0,
    governanceLayer: extra?.governanceLayer ?? 0,
    politicalTracker: extra?.politicalTracker ?? 0,
    tokenQuality: extra?.tokenQuality ?? 0,
  };
  return colAKComposite(sub, weights);
}

export function colAL(returnWeightedAvg: number): "Consider Entry" | "Consider Exit" | "Hold" {
  if (returnWeightedAvg > 0.05) return "Consider Entry";
  if (returnWeightedAvg < -0.05) return "Consider Exit";
  return "Hold";
}

export function colAM(rsi: number | null): "Consider Entry" | "Consider Exit" | "Hold" | "Loading…" {
  if (rsi == null || !Number.isFinite(rsi)) return "Loading…";
  if (rsi > 70) return "Consider Exit";
  if (rsi < 30) return "Consider Entry";
  return "Hold";
}

export function computeRSI(closes: number[]): number | null {
  const values = closes.filter((c) => Number.isFinite(c));
  if (values.length < 15) return null;
  const p = values.slice(-15);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < p.length; i++) {
    const delta = p[i]! - p[i - 1]!;
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - 100 / (1 + rs), 2);
}

export function colAU(rankOverall: number): number {
  if (!Number.isFinite(rankOverall)) return 0;
  if (rankOverall > 55) return 0;
  if (rankOverall <= 40) return 0.0075;
  if (rankOverall <= 50) return 0.0025;
  return 0.0015;
}

export function colAR(targetSleevePct: number, totalMV: number): number {
  return round(targetSleevePct * totalMV, 4);
}

export function colAS(parityDollars: number, marketValue: number): number {
  return round(parityDollars - marketValue, 4);
}

export function colAT(parityChangeDollars: number, price: number): number {
  return round(safeDiv(parityChangeDollars, price), 6);
}

export function denseRank(values: (number | null)[], ascending = false): Map<number, number> {
  const uniques = [...new Set(values.filter((v): v is number => v != null && Number.isFinite(v)))];
  uniques.sort((a, b) => (ascending ? a - b : b - a));
  const m = new Map<number, number>();
  uniques.forEach((v, i) => m.set(v, i + 1));
  return m;
}

export function computePortfolioRanks<
  T extends {
    rowStatus: string;
    currentWeight?: number | null;
    expenseRatio?: number | null;
    returnWeightedAvg?: number | null;
    divApy?: number | null;
    volatilityAbs?: number | null;
    volatilitySigned?: number | null;
    thirteenFScore?: number | null;
    macroIntelligenceScore?: number | null;
    governanceLayerScore?: number | null;
    politicalTrackerScore?: number | null;
    tokenQualityScore?: number | null;
    subRankCurrent?: number | null;
    subRankExpense?: number | null;
    subRankWeightedRet?: number | null;
    subRankDivApy?: number | null;
    subRankVolatility?: number | null;
    subRankThirteenF?: number | null;
    subRankMacroIntelligence?: number | null;
    subRankGovernanceLayer?: number | null;
    subRankPoliticalTracker?: number | null;
    subRankTokenQuality?: number | null;
    subRankVolSigned?: number | null;
    compositeScore?: number | null;
  },
>(rows: T[], assumptions: Assumptions): T[] {
  const active = rows.map((r, idx) => ({ r, idx })).filter((x) => x.r.rowStatus === "Active");
  const currentRank = denseRank(active.map((x) => x.r.currentWeight ?? null), false);
  const expenseRank = denseRank(active.map((x) => x.r.expenseRatio ?? null), true);
  const wretRank = denseRank(active.map((x) => x.r.returnWeightedAvg ?? null), false);
  const divRank = denseRank(active.map((x) => x.r.divApy ?? null), false);
  const volRank = denseRank(active.map((x) => x.r.volatilityAbs ?? null), true);
  const volSignedRank = denseRank(active.map((x) => x.r.volatilitySigned ?? null), false);
  const thirteenFRank = denseRank(active.map((x) => x.r.thirteenFScore ?? null), false);
  const macroRank = denseRank(active.map((x) => x.r.macroIntelligenceScore ?? null), false);
  const governanceRank = denseRank(active.map((x) => x.r.governanceLayerScore ?? null), false);
  const politicalRank = denseRank(active.map((x) => x.r.politicalTrackerScore ?? null), true);
  const tokenQualityRank = denseRank(active.map((x) => x.r.tokenQualityScore ?? null), false);

  const out = rows.map((r) => ({ ...r }));
  active.forEach(({ r, idx }) => {
    const srCurrent = r.currentWeight != null ? (currentRank.get(r.currentWeight) ?? null) : null;
    const srExpense = r.expenseRatio != null ? (expenseRank.get(r.expenseRatio) ?? null) : null;
    const srWRet = r.returnWeightedAvg != null ? (wretRank.get(r.returnWeightedAvg) ?? null) : null;
    const srDiv = r.divApy != null ? (divRank.get(r.divApy) ?? null) : null;
    const srVol = r.volatilityAbs != null ? (volRank.get(r.volatilityAbs) ?? null) : null;
    const srVolSigned =
      r.volatilitySigned != null ? (volSignedRank.get(r.volatilitySigned) ?? null) : null;
    const coreReady = srExpense != null && srWRet != null && srDiv != null && srVol != null;
    const sr13 = r.thirteenFScore != null ? (thirteenFRank.get(r.thirteenFScore) ?? null) : null;
    const srMacro =
      r.macroIntelligenceScore != null ? (macroRank.get(r.macroIntelligenceScore) ?? null) : null;
    const srGov =
      r.governanceLayerScore != null ? (governanceRank.get(r.governanceLayerScore) ?? null) : null;
    const srPol =
      r.politicalTrackerScore != null ? (politicalRank.get(r.politicalTrackerScore) ?? null) : null;
    const srTok =
      r.tokenQualityScore != null ? (tokenQualityRank.get(r.tokenQualityScore) ?? null) : null;
    const composite = coreReady
      ? colAK(srExpense, srWRet, srDiv, srVol, assumptions.factor_weights, {
          pctWeight: srCurrent ?? 0,
          thirteenF: sr13 ?? 0,
          macroIntelligence: srMacro ?? 0,
          governanceLayer: srGov ?? 0,
          politicalTracker: srPol ?? 0,
          tokenQuality: srTok ?? 0,
        })
      : null;
    Object.assign(out[idx]!, {
      subRankCurrent: srCurrent,
      subRankExpense: srExpense,
      subRankWeightedRet: srWRet,
      subRankDivApy: srDiv,
      subRankVolatility: srVol,
      subRankThirteenF: sr13,
      subRankMacroIntelligence: srMacro,
      subRankGovernanceLayer: srGov,
      subRankPoliticalTracker: srPol,
      subRankTokenQuality: srTok,
      subRankVolSigned: srVolSigned,
      compositeScore: composite,
    });
  });
  return out as T[];
}

export function normaliseWeights(
  weights: Assumptions["return_weights"],
): Assumptions["return_weights"] {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, v / sum]),
  ) as Assumptions["return_weights"];
}
