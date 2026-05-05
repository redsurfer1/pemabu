"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPrices, getHistoricalPrices } from "@/lib/prices/priceService";
import { computePortfolioAllocations } from "@/lib/allocation/engine";
import type {
  AllocationEngineHolding,
  EngineAssumptions,
  SleeveRole,
} from "@/types/allocation";
import { DEFAULT_ENGINE_ASSUMPTIONS } from "@/types/allocation";

interface SleeveRow {
  id: string;
  purpose: string;
  weighting_method: string | null;
}

interface HoldingRow {
  id: string;
  sleeve_id: string;
  ticker: string;
  name: string;
  status: string;
  theme: string;
  qty: number;
  price_seed: number;
  expense_ratio: number;
  div_dollar: number;
  target_wt_pct: number;
  manual_pricing: boolean | null;
  manual_target_wt: number | null;
}

function resolveSleeveRole(s: SleeveRow): SleeveRole {
  const wm = s.weighting_method;
  if (wm === "YIELD_PROPORTIONAL") return "INCOME";
  if (wm === "MANUAL") return "MANUAL";
  if (wm === "COMPOSITE_SCORE") return "MAIN";
  if (s.purpose === "Income") return "INCOME";
  if (s.purpose === "Stability") return "MANUAL";
  return "MAIN";
}

export async function refreshPrices(portfolioId: string) {
  const supabase = await createClient();

  const { data: assumptionsRow } = await supabase
    .from("model_assumptions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .maybeSingle();

  const assumptions: EngineAssumptions = assumptionsRow
    ? {
        retWeight3mo: Number(assumptionsRow.ret_weight_3mo),
        retWeight6mo: Number(assumptionsRow.ret_weight_6mo),
        retWeight1yr: Number(assumptionsRow.ret_weight_1yr),
        retWeight3yr: Number(assumptionsRow.ret_weight_3yr),
        retWeight5yr: Number(assumptionsRow.ret_weight_5yr),
        scoreWeightExp: Number(assumptionsRow.score_weight_exp),
        scoreWeightRet: Number(assumptionsRow.score_weight_ret),
        scoreWeightDiv: Number(assumptionsRow.score_weight_div),
        scoreWeightShp: Number(assumptionsRow.score_weight_shp),
        incomeBudgetPct: Number(assumptionsRow.income_budget_pct),
        volCapMultiplier: Number(assumptionsRow.vol_cap_multiplier),
        themeCapPct: Number(assumptionsRow.theme_cap_pct),
      }
    : DEFAULT_ENGINE_ASSUMPTIONS;

  const { data: sleeves } = await supabase
    .from("sleeves")
    .select("id, purpose, weighting_method")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true)
    .order("sort_order");

  if (!sleeves?.length) return { success: false as const, error: "No sleeves found" };

  const sleeveIds = sleeves.map((s: SleeveRow) => s.id);
  const sleeveById = new Map(sleeves.map((s: SleeveRow) => [s.id, s]));

  const { data: allHoldings } = await supabase
    .from("sleeve_holdings")
    .select("*")
    .in("sleeve_id", sleeveIds);

  if (!allHoldings?.length)
    return { success: false as const, error: "No holdings found" };

  const rows = allHoldings as HoldingRow[];

  const stabilitySleeveIds = new Set(
    sleeves
      .filter((s: SleeveRow) => s.purpose === "Stability")
      .map((s: SleeveRow) => s.id),
  );

  const priceable = rows.filter((h) => {
    if (stabilitySleeveIds.has(h.sleeve_id)) return false;
    if (h.manual_pricing === true) return false;
    return true;
  });
  const uniqueTickers = [...new Set(priceable.map((h) => h.ticker))];

  const [currentPrices, historicalPrices] = await Promise.all([
    getCurrentPrices(supabase, uniqueTickers),
    getHistoricalPrices(supabase, uniqueTickers),
  ]);

  let totalNAV = 0;
  for (const h of rows) {
    const px =
      h.manual_pricing === true
        ? Number(h.price_seed)
        : (currentPrices[h.ticker] ?? Number(h.price_seed));
    totalNAV += Number(h.qty) * px;
  }

  const engineInputs: AllocationEngineHolding[] = rows.map((h) => {
    const sleeve = sleeveById.get(h.sleeve_id)!;
    const role = resolveSleeveRole(sleeve);
    const hist = historicalPrices[h.ticker] ?? {};
    const manual = h.manual_pricing === true;
    const price = manual ? Number(h.price_seed) : (currentPrices[h.ticker] ?? Number(h.price_seed));
    return {
      id: h.id,
      name: h.name,
      ticker: h.ticker,
      sleeveRole: role,
      status: h.status as "Active" | "Comparable",
      theme: h.theme,
      qty: Number(h.qty),
      price,
      expenseRatio: Number(h.expense_ratio),
      divDollar: Number(h.div_dollar),
      manualPricing: manual,
      manualTargetWt:
        h.manual_target_wt != null ? Number(h.manual_target_wt) : Number(h.target_wt_pct),
      price3mo: hist["3mo"] ?? 0,
      price6mo: hist["6mo"] ?? 0,
      price1yr: hist["1yr"] ?? 0,
      price3yr: hist["3yr"] ?? 0,
      price5yr: hist["5yr"] ?? 0,
    };
  });

  const upperPrices: Record<string, number> = Object.fromEntries(
    Object.entries(currentPrices).map(([k, v]) => [k.toUpperCase(), v]),
  );

  const computed = computePortfolioAllocations(
    engineInputs,
    historicalPrices,
    upperPrices,
    assumptions,
    totalNAV,
  );

  for (const h of rows) {
    const px = currentPrices[h.ticker];
    if (px != null && h.manual_pricing !== true) {
      await supabase
        .from("sleeve_holdings")
        .update({ price_seed: px, updated_at: new Date().toISOString() })
        .eq("id", h.id);
    }
  }

  const snapshotsToInsert: Array<Record<string, unknown>> = [];
  const day = new Date().toISOString().slice(0, 10);

  for (const c of computed) {
    const holdingRow = rows.find((r) => r.id === c.id);
    if (!holdingRow) continue;
    const hist = historicalPrices[c.ticker] ?? {};
    snapshotsToInsert.push({
      holding_id: holdingRow.id,
      date: day,
      price: c.price,
      value: c.value,
      current_wt_pct: c.currentWtPct,
      target_wt_pct: c.targetWtPct,
      parity_gap_pct: c.parityGapPct,
      parity_dollar: c.parityDollarChg,
      parity_dollar_amt: c.parityDollarAmt ?? c.targetWtPct * totalNAV,
      parity_dollar_chg: c.parityDollarChg,
      blended_return: c.blendedReturn,
      composite_score: c.compositeScore,
      score_rank: c.scoreRank,
      vol_cap_flag: c.volCapFlag,
      theme_exposure_pct: c.themeExposurePct,
      theme_capped_wt: c.themeCappedWt ?? 0,
      pr_expense: c.prExpense,
      pr_return: c.prReturn,
      pr_div_apy: c.prDivAPY,
      pr_sharpe: c.prSharpe,
      vol_3mo: c.vol3mo,
      sharpe_proxy: c.sharpeProxy,
      div_apy: c.divAPY,
      raw_score_wt: c.rawScoreWt,
      equal_wt_base: c.equalWtBase,
      signal: c.trendSignal,
      ret_3mo: c.ret3mo,
      ret_6mo: c.ret6mo,
      ret_1yr: c.ret1yr,
      ret_3yr: c.ret3yr,
      ret_5yr: c.ret5yr,
      price_3mo: c.price3mo ?? hist["3mo"] ?? 0,
      price_6mo: c.price6mo ?? hist["6mo"] ?? 0,
      price_1yr: c.price1yr ?? hist["1yr"] ?? 0,
      price_3yr: c.price3yr ?? hist["3yr"] ?? 0,
      price_5yr: c.price5yr ?? hist["5yr"] ?? 0,
    });
  }

  if (snapshotsToInsert.length > 0) {
    await supabase.from("sleeve_snapshots").insert(snapshotsToInsert);
  }

  return { success: true as const, totalNAV, holdingsProcessed: snapshotsToInsert.length };
}
