// lib/allocation/engine.ts
// Core allocation calculation functions.
// Pure functions — no side effects, no DB calls.
// All inputs and outputs are typed from
// lib/types/database.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Holding, AllocationWeight, AssetClass } from "@/lib/types/database";
import {
  DEFAULT_ASSUMPTIONS,
  colAA,
  colAB,
  colAC,
  colAD,
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
} from "@/lib/portfolio/formula-engine";
import { fetchMarketDataWithFallback } from "@/lib/market-data/yahoo-finance";

// Quote shape from market data provider
export interface Quote {
  ticker: string;
  price: number;
  currency: string;
  asOf: Date;
  source: string;
}

// Target allocation configuration per portfolio
// Stored in portfolio metadata or defaults
export interface AllocationTarget {
  asset_class: AssetClass;
  target_pct: number; // 0-100
}

// Default targets if user has not configured custom ones
export const DEFAULT_TARGETS: AllocationTarget[] = [
  { asset_class: "equity", target_pct: 38 },
  { asset_class: "fixed_income", target_pct: 28 },
  { asset_class: "alternatives", target_pct: 22 },
  { asset_class: "cash", target_pct: 12 },
];

// DRIFT_THRESHOLD_PCT: default % deviation that
// triggers a drift signal. Configurable per portfolio
// in metadata — default 5%.
export const DRIFT_THRESHOLD_PCT = 5;

/**
 * Calculate the current USD value of a single holding.
 * Uses current_price if quote not provided (stale ok
 * for display; use quotes for cron accuracy).
 */
export function calculateHoldingValue(holding: Holding, quote?: Quote): number {
  const price = quote?.price ?? holding.current_price ?? 0;
  return Number(holding.quantity) * price;
}

/**
 * Calculate total portfolio equity across all holdings.
 * Port of calculateTotalEquity from Agentic-Alpha.
 */
export function calculatePortfolioValue(
  holdings: Holding[],
  quotes: Map<string, Quote>,
): number {
  return holdings.reduce((total, holding) => {
    const quote = quotes.get(holding.ticker);
    return total + calculateHoldingValue(holding, quote);
  }, 0);
}

/**
 * Calculate allocation weights — actual vs target.
 * Returns one AllocationWeight per asset class.
 * This is the core allocation intelligence function.
 */
export function calculateAllocationWeights(
  holdings: Holding[],
  quotes: Map<string, Quote>,
  targets: AllocationTarget[] = DEFAULT_TARGETS,
): AllocationWeight[] {
  const totalValue = calculatePortfolioValue(holdings, quotes);

  if (totalValue === 0) {
    return targets.map((t) => ({
      asset_class: t.asset_class,
      target_pct: t.target_pct,
      actual_pct: 0,
      drift_pct: -t.target_pct,
      value_usd: 0,
    }));
  }

  // Sum value by asset class
  const valueByClass = new Map<AssetClass, number>();
  for (const holding of holdings) {
    const quote = quotes.get(holding.ticker);
    const value = calculateHoldingValue(holding, quote);
    const current = valueByClass.get(holding.asset_class) ?? 0;
    valueByClass.set(holding.asset_class, current + value);
  }

  return targets.map((target) => {
    const value = valueByClass.get(target.asset_class) ?? 0;
    const actual_pct = (value / totalValue) * 100;
    const drift_pct = actual_pct - target.target_pct;
    return {
      asset_class: target.asset_class,
      target_pct: target.target_pct,
      actual_pct: Math.round(actual_pct * 100) / 100,
      drift_pct: Math.round(drift_pct * 100) / 100,
      value_usd: Math.round(value * 100) / 100,
    };
  });
}

/**
 * Detect drift events from allocation weights.
 * Returns asset classes that exceed DRIFT_THRESHOLD_PCT.
 */
export function detectDrift(
  weights: AllocationWeight[],
  thresholdPct: number = DRIFT_THRESHOLD_PCT,
): Array<{
  asset_class: AssetClass;
  target_pct: number;
  actual_pct: number;
  drift_pct: number;
  direction: "over" | "under";
}> {
  return weights
    .filter((w) => Math.abs(w.drift_pct) >= thresholdPct)
    .map((w) => ({
      asset_class: w.asset_class,
      target_pct: w.target_pct,
      actual_pct: w.actual_pct,
      drift_pct: w.drift_pct,
      direction: w.drift_pct > 0 ? "over" : "under",
    }));
}

export interface HoldingWeightRow {
  holding_id: string;
  ticker: string;
  value_usd: number;
  /** Actual percent of portfolio MV (0–100). */
  weight_pct: number;
}

/**
 * Per-holding market-value weights vs total portfolio.
 */
export function calculateHoldingWeights(
  holdings: Holding[],
  quotes: Map<string, Quote>,
): HoldingWeightRow[] {
  const totalValue = calculatePortfolioValue(holdings, quotes);
  if (totalValue === 0) {
    return holdings.map((h) => ({
      holding_id: h.id,
      ticker: h.ticker,
      value_usd: 0,
      weight_pct: 0,
    }));
  }

  return holdings.map((h) => {
    const q = quotes.get(h.ticker);
    const value = calculateHoldingValue(h, q);
    return {
      holding_id: h.id,
      ticker: h.ticker,
      value_usd: Math.round(value * 100) / 100,
      weight_pct: Math.round((value / totalValue) * 10000) / 100,
    };
  });
}

export interface HoldingDriftRow {
  holding_id: string;
  ticker: string;
  target_pct: number | null;
  actual_pct: number;
  drift_pct: number | null;
  has_target: boolean;
}

/**
 * Per-line drift when `target_weight_pct` is set on holdings (percent 0–100).
 */
export function calculateHoldingDrift(
  holdingWeights: HoldingWeightRow[],
  holdings: Holding[],
): HoldingDriftRow[] {
  return holdingWeights.map((hw) => {
    const holding = holdings.find((h) => h.id === hw.holding_id);
    const target = holding?.target_weight_pct ?? null;
    return {
      holding_id: hw.holding_id,
      ticker: hw.ticker,
      target_pct: target,
      actual_pct: hw.weight_pct,
      drift_pct:
        target !== null ? Math.round((hw.weight_pct - target) * 100) / 100 : null,
      has_target: target !== null,
    };
  });
}

/**
 * Build snapshot_data JSON for AllocationSnapshot.
 * Stored in allocation_snapshots.snapshot_data (jsonb).
 */
export function buildSnapshotData(
  holdings: Holding[],
  weights: AllocationWeight[],
  quotes: Map<string, Quote>,
): Record<string, unknown> {
  const holdingWeights = calculateHoldingWeights(holdings, quotes);
  const weightById = new Map(holdingWeights.map((w) => [w.holding_id, w.weight_pct]));

  return {
    holdings: holdings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      asset_class: h.asset_class,
      quantity: h.quantity,
      current_price: quotes.get(h.ticker)?.price ?? h.current_price,
      value_usd: calculateHoldingValue(h, quotes.get(h.ticker)),
      weight_pct: weightById.get(h.id) ?? 0,
    })),
    weights,
    captured_at: new Date().toISOString(),
  };
}

type AssumptionRow = {
  weight_3mo: number;
  weight_6mo: number;
  weight_1yr: number;
  weight_3yr: number;
  weight_5yr: number;
  factor_expense: number;
  factor_pct_weight: number;
  factor_div_apy: number;
  factor_volatility: number;
};

type RefreshRow = {
  id: string;
  portfolio_id: string;
  ticker: string;
  name: string | null;
  quantity: number;
  expense_ratio: number | null;
  dividend_dollars: number | null;
  target_parity_weight: number | null;
};

type RankedWorkRow = {
  id: string;
  rowStatus: string;
  ticker: string;
  quantity: number;
  marketDataError?: boolean;
  expenseRatio: number | null;
  divApy: number | null;
  currentWeight: number | null;
  returnWeightedAvg: number | null;
  volatilityAbs: number | null;
  volatilitySigned: number | null;
  subRankCurrent?: number | null;
  subRankExpense?: number | null;
  subRankWeightedRet?: number | null;
  subRankDivApy?: number | null;
  subRankVolatility?: number | null;
  subRankVolSigned?: number | null;
  compositeScore?: number | null;
  market_value: number | null;
  return_3mo: number | null;
  return_6mo: number | null;
  return_1yr: number | null;
  return_3yr: number | null;
  return_5yr: number | null;
  return_avg: number | null;
  rsi_14: number | null;
};

export async function refreshPortfolioSignals(
  portfolioId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: rows, error: holdingsErr } = await supabase
    .from("portfolio_holdings")
    .select(
      "id,portfolio_id,ticker,name,quantity,expense_ratio,dividend_dollars,target_parity_weight",
    )
    .eq("portfolio_id", portfolioId)
    .order("ticker", { ascending: true });
  if (holdingsErr) throw holdingsErr;
  const holdings = ((rows ?? []) as RefreshRow[]).map((h) => ({
    ...h,
    quantity: Number(h.quantity),
  }));
  if (holdings.length === 0) return;

  const { data: ass } = await supabase
    .from("portfolio_assumptions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .single();
  const assumption = (ass as AssumptionRow | null) ?? null;
  const assumptions = assumption
    ? {
        return_weights: {
          r3mo: Number(assumption.weight_3mo),
          r6mo: Number(assumption.weight_6mo),
          r1yr: Number(assumption.weight_1yr),
          r3yr: Number(assumption.weight_3yr),
          r5yr: Number(assumption.weight_5yr),
        },
        factor_weights: {
          expense: Number(assumption.factor_expense),
          pctWeight: Number(assumption.factor_pct_weight),
          divApy: Number(assumption.factor_div_apy),
          volatility: Number(assumption.factor_volatility),
        },
      }
    : DEFAULT_ASSUMPTIONS;

  const market = await Promise.all(holdings.map((h) => fetchMarketDataWithFallback(h.ticker)));
  const marketByTicker = new Map(market.map((m) => [m.ticker, m]));

  const withBase = holdings.map((h) => {
    const md = marketByTicker.get(h.ticker) ?? null;
    const marketDataError = Boolean(md?.error);
    if (marketDataError) {
      return {
        id: h.id,
        ticker: h.ticker,
        rowStatus: "Comparable",
        marketDataError: true,
        quantity: Number(h.quantity),
        expenseRatio: h.expense_ratio != null ? Number(h.expense_ratio) : null,
        divApy: null,
        currentWeight: null as number | null,
        returnWeightedAvg: null as number | null,
        volatilityAbs: null as number | null,
        volatilitySigned: null as number | null,
        market_value: null as number | null,
        price_current: null as number | null,
        price_24h_basis: null as number | null,
        price_7d_basis: null as number | null,
        basis_price_3mo: null as number | null,
        basis_price_6mo: null as number | null,
        basis_price_1yr: null as number | null,
        basis_price_3yr: null as number | null,
        basis_price_5yr: null as number | null,
        volatility_3mo: null as number | null,
        rsi_14: null as number | null,
        change_24h: null as number | null,
        change_7d: null as number | null,
        return_3mo: null as number | null,
        return_6mo: null as number | null,
        return_1yr: null as number | null,
        return_3yr: null as number | null,
        return_5yr: null as number | null,
        return_avg: null as number | null,
        return_weighted_avg: null as number | null,
        volatility_abs: null as number | null,
        volatility_signed: null as number | null,
        target_parity_weight: h.target_parity_weight != null ? Number(h.target_parity_weight) : null,
        target_sleeve_pct: null as number | null,
        parity_dollars: null as number | null,
        parity_change_dollars: null as number | null,
        shares_delta: null as number | null,
        alert_primary: null as string | null,
        alert_secondary: null as string | null,
        rank_overall: null as number | null,
        composite_score: null as number | null,
        sub_rank_current: null as number | null,
        sub_rank_expense: null as number | null,
        sub_rank_weighted_ret: null as number | null,
        sub_rank_div_apy: null as number | null,
        sub_rank_volatility: null as number | null,
        sub_rank_vol_signed: null as number | null,
      };
    }
    const price1 = md?.price1 ?? 0;
    const price2 = md?.price2 ?? 0;
    const price3 = md?.price3 ?? 0;
    const market_value = colJ(Number(h.quantity), price1);
    const divApy = colH(Number(h.dividend_dollars ?? 0), market_value);
    const return_3mo = colV(price1, md?.basisPrice3mo ?? 0);
    const return_6mo = colW(price1, md?.basisPrice6mo ?? 0);
    const return_1yr = colX(price1, md?.basisPrice1yr ?? 0);
    const return_3yr = colY(price1, md?.basisPrice3yr ?? 0);
    const return_5yr = colZ(price1, md?.basisPrice5yr ?? 0);
    const return_avg = colAA([return_3mo, return_6mo, return_1yr, return_3yr, return_5yr]);
    const return_weighted_avg = colAB(
      return_3mo,
      return_6mo,
      return_1yr,
      return_3yr,
      return_5yr,
      assumptions.return_weights,
    );
    const volatilityAbs = colAC(return_3mo);
    const volatilitySigned = colAD(return_3mo);
    const rsi = computeRSI(md?.recentCloses ?? []);
    return {
      id: h.id,
      ticker: h.ticker,
      rowStatus: "Active",
      marketDataError: false,
      quantity: Number(h.quantity),
      expenseRatio: h.expense_ratio != null ? Number(h.expense_ratio) : null,
      divApy,
      currentWeight: null as number | null,
      returnWeightedAvg: return_weighted_avg,
      volatilityAbs,
      volatilitySigned,
      market_value,
      price_current: price1,
      price_24h_basis: price2,
      price_7d_basis: price3,
      basis_price_3mo: md?.basisPrice3mo ?? null,
      basis_price_6mo: md?.basisPrice6mo ?? null,
      basis_price_1yr: md?.basisPrice1yr ?? null,
      basis_price_3yr: md?.basisPrice3yr ?? null,
      basis_price_5yr: md?.basisPrice5yr ?? null,
      volatility_3mo: md?.volatility3mo ?? null,
      rsi_14: rsi,
      change_24h: colO(price1, price2),
      change_7d: colP(price1, price3),
      return_3mo,
      return_6mo,
      return_1yr,
      return_3yr,
      return_5yr,
      return_avg,
      return_weighted_avg,
      volatility_abs: volatilityAbs,
      volatility_signed: volatilitySigned,
      target_parity_weight: h.target_parity_weight != null ? Number(h.target_parity_weight) : null,
      target_sleeve_pct: null as number | null,
      parity_dollars: null as number | null,
      parity_change_dollars: null as number | null,
      shares_delta: null as number | null,
      alert_primary: null as string | null,
      alert_secondary: null as string | null,
      rank_overall: null as number | null,
      composite_score: null as number | null,
      sub_rank_current: null as number | null,
      sub_rank_expense: null as number | null,
      sub_rank_weighted_ret: null as number | null,
      sub_rank_div_apy: null as number | null,
      sub_rank_volatility: null as number | null,
      sub_rank_vol_signed: null as number | null,
    };
  });

  const totalMV = withBase.reduce((s, r) => s + (r.market_value ?? 0), 0);
  for (const row of withBase) {
    row.currentWeight = row.market_value != null ? colD(row.market_value, totalMV) : null;
  }

  const ranked = computePortfolioRanks(
    withBase as unknown as RankedWorkRow[],
    assumptions,
  ) as unknown as Array<typeof withBase[number] & RankedWorkRow>;

  const rankMap = denseRank(ranked.map((r) => r.compositeScore ?? null), false);
  for (const row of ranked) {
    if (row.marketDataError) {
      row.rank_overall = null;
      row.alert_primary = null;
      row.alert_secondary = null;
      row.target_sleeve_pct = null;
      row.parity_dollars = null;
      row.parity_change_dollars = null;
      row.shares_delta = null;
      row.composite_score = null;
      row.sub_rank_current = null;
      row.sub_rank_expense = null;
      row.sub_rank_weighted_ret = null;
      row.sub_rank_div_apy = null;
      row.sub_rank_volatility = null;
      row.sub_rank_vol_signed = null;
      continue;
    }
    const rankOverall = row.compositeScore != null ? (rankMap.get(row.compositeScore) ?? null) : null;
    row.rank_overall = rankOverall;
    row.alert_primary = colAL(row.return_weighted_avg ?? 0);
    row.alert_secondary = colAM(row.rsi_14);
    row.target_sleeve_pct = rankOverall != null ? colAU(rankOverall) : 0;
    row.parity_dollars = colAR(row.target_sleeve_pct, totalMV);
    row.parity_change_dollars = colAS(row.parity_dollars, row.market_value ?? 0);
    row.shares_delta = colAT(row.parity_change_dollars, row.price_current ?? 0);
    row.composite_score = row.compositeScore ?? null;
    row.sub_rank_current = row.subRankCurrent ?? null;
    row.sub_rank_expense = row.subRankExpense ?? null;
    row.sub_rank_weighted_ret = row.subRankWeightedRet ?? null;
    row.sub_rank_div_apy = row.subRankDivApy ?? null;
    row.sub_rank_volatility = row.subRankVolatility ?? null;
    row.sub_rank_vol_signed = row.subRankVolSigned ?? null;
  }

  const now = new Date().toISOString();
  const upserts = ranked.map((row) => ({
    id: row.id,
    portfolio_id: portfolioId,
    expense_ratio: row.expenseRatio,
    quantity: row.quantity,
    target_parity_weight: row.target_parity_weight,
    price_current: row.price_current,
    price_24h_basis: row.price_24h_basis,
    price_7d_basis: row.price_7d_basis,
    basis_price_3mo: row.basis_price_3mo,
    basis_price_6mo: row.basis_price_6mo,
    basis_price_1yr: row.basis_price_1yr,
    basis_price_3yr: row.basis_price_3yr,
    basis_price_5yr: row.basis_price_5yr,
    volatility_3mo: row.volatility_3mo,
    rsi_14: row.rsi_14,
    last_market_refresh: now,
    change_24h: row.change_24h,
    change_7d: row.change_7d,
    return_3mo: row.return_3mo,
    return_6mo: row.return_6mo,
    return_1yr: row.return_1yr,
    return_3yr: row.return_3yr,
    return_5yr: row.return_5yr,
    return_avg: row.return_avg,
    return_weighted_avg: row.return_weighted_avg,
    market_value: row.market_value,
    current_weight: row.currentWeight,
    div_apy: row.divApy,
    sub_rank_current: row.sub_rank_current,
    sub_rank_expense: row.sub_rank_expense,
    sub_rank_weighted_ret: row.sub_rank_weighted_ret,
    sub_rank_div_apy: row.sub_rank_div_apy,
    sub_rank_volatility: row.sub_rank_volatility,
    sub_rank_vol_signed: row.sub_rank_vol_signed,
    composite_score: row.composite_score,
    rank_overall: row.rank_overall,
    alert_primary: row.alert_primary,
    alert_secondary: row.alert_secondary,
    target_sleeve_pct: row.target_sleeve_pct,
    parity_dollars: row.parity_dollars,
    parity_change_dollars: row.parity_change_dollars,
    shares_delta: row.shares_delta,
    updated_at: now,
  }));

  const { error: upsertErr } = await supabase
    .from("portfolio_holdings")
    .upsert(upserts, { onConflict: "id" });
  if (upsertErr) throw upsertErr;
}
