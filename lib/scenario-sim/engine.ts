import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveProvider } from "@/lib/market-data";
import { DEFAULT_TARGETS, type AllocationTarget } from "@/lib/allocation/asset-class-utils";

export interface SimInput {
  portfolioId: string;
  adjustments: Record<string, number>;
}

interface HoldingRow {
  id: string;
  ticker: string;
  asset_class: string;
  quantity: number;
  current_price: number | null;
}

export interface SimResult {
  label: string;
  baseline: Record<string, number>;
  adjustments: Record<string, number>;
  projected_allocation: Record<string, number>;
  projected_drift_reduction_pct: number;
  run_at: string;
}

const ASSET_CLASSES = ["equity", "fixed_income", "alternatives", "cash", "crypto"] as const;

export async function runSimulation(input: SimInput, label: string): Promise<SimResult> {
  const { data: sleeves } = await supabaseAdmin
    .from("sleeves")
    .select("id, purpose")
    .eq("portfolio_id", input.portfolioId)
    .eq("is_active", true);

  const sleeveIds = (sleeves ?? []).map((s) => s.id);
  let holdings: HoldingRow[] = [];

  if (sleeveIds.length > 0) {
    const { data: sleeveHoldings } = await supabaseAdmin
      .from("sleeve_holdings")
      .select("id, ticker, qty, manual_pricing, price_seed")
      .in("sleeve_id", sleeveIds);
    const raw = ((sleeveHoldings ?? []) as unknown) as Array<{
      id: string; ticker: string; qty: number; manual_pricing: boolean | null; price_seed: number | null;
    }>;
    holdings = raw.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      asset_class: "equity",
      quantity: Number(h.qty ?? 0),
      current_price: h.manual_pricing ? Number(h.price_seed) : null,
    }));
  } else {
    const { data: oldHoldings } = await supabaseAdmin
      .from("portfolio_holdings")
      .select("id, ticker, asset_class, quantity, current_price")
      .eq("portfolio_id", input.portfolioId);
    holdings = (oldHoldings ?? []).map((h: Record<string, unknown>) => ({
      id: String(h.id),
      ticker: String(h.ticker),
      asset_class: String(h.asset_class ?? "equity"),
      quantity: Number(h.quantity ?? 0),
      current_price: h.current_price != null ? Number(h.current_price) : null,
    }));
  }

  if (holdings.length === 0) {
    throw new Error("No holdings found for this portfolio");
  }

  const tickers = [...new Set(holdings.map((h) => h.ticker))];
  const provider = getActiveProvider();
  const prices: Record<string, number> = {};

  try {
    const result = await provider.getQuotes(tickers);
    for (const q of result.quotes) {
      prices[q.ticker.toUpperCase()] = q.price;
    }
  } catch {
    for (const h of holdings) {
      if (h.current_price != null) {
        prices[h.ticker.toUpperCase()] = h.current_price;
      }
    }
  }

  for (const h of holdings) {
    if (prices[h.ticker.toUpperCase()] == null && h.current_price != null) {
      prices[h.ticker.toUpperCase()] = h.current_price;
    }
  }
  if (holdings.some((h) => h.asset_class === "cash")) {
    prices["CASH"] = 1;
  }

  const totalValue = holdings.reduce((sum, h) => {
    const price = prices[h.ticker.toUpperCase()] ?? 0;
    return sum + h.quantity * price;
  }, 0);

  const valueByClass: Record<string, number> = {};
  for (const h of holdings) {
    const price = prices[h.ticker.toUpperCase()] ?? 0;
    const ac = h.asset_class;
    valueByClass[ac] = (valueByClass[ac] ?? 0) + h.quantity * price;
  }

  const baseline: Record<string, number> = {};
  for (const ac of ASSET_CLASSES) {
    const v = valueByClass[ac] ?? 0;
    baseline[ac] = totalValue > 0 ? Math.round((v / totalValue) * 10000) / 100 : 0;
  }

  const targets: AllocationTarget[] = (() => {
    const userTargets = DEFAULT_TARGETS.map((t) => ({ ...t }));
    for (const [ac, delta] of Object.entries(input.adjustments)) {
      const existing = userTargets.find((t) => t.asset_class === ac);
      if (existing) {
        existing.target_pct = Math.max(0, Math.min(100, existing.target_pct + delta));
      }
    }
    const totalTarget = userTargets.reduce((s, t) => s + t.target_pct, 0);
    if (totalTarget > 0 && totalTarget !== 100) {
      const scale = 100 / totalTarget;
      for (const t of userTargets) {
        t.target_pct = Math.round(t.target_pct * scale * 100) / 100;
      }
    }
    return userTargets;
  })();

  const projectedAllocation: Record<string, number> = {};
  for (const ac of ASSET_CLASSES) {
    projectedAllocation[ac] = targets.find((t) => t.asset_class === ac)?.target_pct ?? 0;
  }

  const currentDrift = ASSET_CLASSES.reduce((sum, ac) => {
    const target = DEFAULT_TARGETS.find((t) => t.asset_class === ac)?.target_pct ?? 0;
    return sum + Math.abs((baseline[ac] ?? 0) - target);
  }, 0);

  const projectedDrift = ASSET_CLASSES.reduce((sum, ac) => {
    return sum + Math.abs((baseline[ac] ?? 0) - (projectedAllocation[ac] ?? 0));
  }, 0);

  const driftReduction = Math.round((currentDrift - projectedDrift) * 100) / 100;

  return {
    label,
    baseline,
    adjustments: { ...input.adjustments },
    projected_allocation: projectedAllocation,
    projected_drift_reduction_pct: Math.max(0, driftReduction),
    run_at: new Date().toISOString(),
  };
}
