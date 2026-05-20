// Asset-class allocation math — pure functions, no side effects.
// These were extracted from the legacy engine.ts when it was consolidated.
// Active sleeve-based development is in v3-engine.ts.

import type { Holding, AllocationWeight, AssetClass } from "@/lib/types/database";

export interface Quote {
  ticker: string;
  price: number;
  currency: string;
  asOf: Date;
  source: string;
}

export interface AllocationTarget {
  asset_class: AssetClass;
  target_pct: number;
}

export const DEFAULT_TARGETS: AllocationTarget[] = [
  { asset_class: "equity", target_pct: 38 },
  { asset_class: "fixed_income", target_pct: 28 },
  { asset_class: "alternatives", target_pct: 22 },
  { asset_class: "cash", target_pct: 12 },
  { asset_class: "crypto", target_pct: 0 },
];

export const DRIFT_THRESHOLD_PCT = 5;

export function calculateHoldingValue(holding: Holding, quote?: Quote): number {
  const price = quote?.price ?? Number(holding.current_price ?? 0);
  const qty = Number(holding.quantity ?? 0);
  return qty * price;
}

export function calculatePortfolioValue(
  holdings: Holding[],
  quotes: Map<string, Quote>,
): number {
  const enrichedQuotes = new Map(quotes);
  for (const h of holdings) {
    if (h.asset_class === "cash") {
      enrichedQuotes.set(h.ticker, {
        ticker: h.ticker,
        price: 1.00,
        currency: "USD",
        asOf: new Date(),
        source: "fixed",
      });
    }
  }

  return holdings.reduce((total, holding) => {
    const quote = enrichedQuotes.get(holding.ticker);
    return total + calculateHoldingValue(holding, quote);
  }, 0);
}

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
  weight_pct: number;
}

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
