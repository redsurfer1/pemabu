"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPrices, getHistoricalPrices } from "@/lib/prices/priceService";
import { computeMainSleeve, computeIncomeSleeve } from "@/lib/allocation/v3-engine";
import type { IncomeHoldingInput } from "@/lib/allocation/v3-engine";
import type { EngineAssumptions, HoldingInput } from "@/types/allocation";
import { DEFAULT_ENGINE_ASSUMPTIONS } from "@/types/allocation";

interface SleeveRow {
  id: string;
  purpose: string;
  weighting_method: string;
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
  manual_pricing: boolean;
  manual_target_wt: number | null;
}

export async function refreshPortfolioPrices(portfolioId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const { getModelAssumptionsForPortfolio } = await import("@/lib/portfolio/model-assumptions-store");
  const assumptionsBySleeve = await getModelAssumptionsForPortfolio(portfolioId);
  const assumptions: EngineAssumptions = assumptionsBySleeve.main;

  // Load sleeves
  const { data: sleeves, error: sleevesErr } = await supabase
    .from("sleeves")
    .select("id, purpose, weighting_method")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true)
    .order("sort_order");

  if (sleevesErr || !sleeves?.length) {
    return { success: false, error: "No active sleeves found" };
  }

  const sleeveIds = (sleeves as SleeveRow[]).map((s) => s.id);

  const { data: allHoldingRows } = await supabase
    .from("sleeve_holdings")
    .select("*")
    .in("sleeve_id", sleeveIds);

  const allHoldings = (allHoldingRows ?? []) as HoldingRow[];
  if (allHoldings.length === 0) return { success: false, error: "No holdings found" };

  // Collect priceable tickers (exclude manual_pricing holdings)
  const priceableTickers = [
    ...new Set(
      allHoldings
        .filter((h) => !h.manual_pricing)
        .map((h) => h.ticker),
    ),
  ];

  const [currentPrices, historicalPrices] = await Promise.all([
    getCurrentPrices(priceableTickers),
    getHistoricalPrices(priceableTickers),
  ]);

  // Update price_seed on all priceable holdings
  for (const holding of allHoldings) {
    if (holding.manual_pricing) continue;
    const price = currentPrices[holding.ticker];
    if (price != null) {
      await supabase
        .from("sleeve_holdings")
        .update({ price_seed: price, updated_at: new Date().toISOString() })
        .eq("id", holding.id);
    }
  }

  // Compute main sleeve NAV first (needed for income sleeve weight denominator)
  let mainNAV = 0;
  const snapshotsToInsert: Array<Record<string, unknown>> = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const sleeve of sleeves as SleeveRow[]) {
    if (sleeve.weighting_method !== "COMPOSITE_SCORE") continue;

    const holdings = allHoldings.filter((h) => h.sleeve_id === sleeve.id);
    const inputs: HoldingInput[] = holdings.map((h) => {
      const price = currentPrices[h.ticker] ?? Number(h.price_seed);
      const hist = historicalPrices[h.ticker] ?? {};
      return {
        id: h.id,
        ticker: h.ticker,
        name: h.name,
        status: h.status as "Active" | "Comparable",
        theme: h.theme,
        qty: Number(h.qty),
        price,
        expenseRatio: Number(h.expense_ratio),
        divDollar: Number(h.div_dollar),
        price3mo: hist["3mo"] ?? 0,
        price6mo: hist["6mo"] ?? 0,
        price1yr: hist["1yr"] ?? 0,
        price3yr: hist["3yr"] ?? 0,
        price5yr: hist["5yr"] ?? 0,
      };
    });

    const result = computeMainSleeve(inputs, assumptions);
    mainNAV += result.totalValue;

    for (const c of result.holdings) {
      snapshotsToInsert.push({
        holding_id: c.id,
        date: today,
        price: c.price,
        value: c.value,
        div_apy: c.divAPY,
        current_wt_pct: c.currentWtPct,
        target_wt_pct: c.targetWtPct,
        parity_gap_pct: c.parityGapPct,
        parity_dollar: c.parityDollarChg,
        parity_dollar_amt: c.parityDollarAmt,
        parity_dollar_chg: c.parityDollarChg,
        blended_return: c.blendedReturn,
        vol_3mo: c.vol3mo,
        sharpe_proxy: c.sharpeProxy,
        pr_expense: c.prExpense,
        pr_return: c.prReturn,
        pr_div_apy: c.prDivAPY,
        pr_sharpe: c.prSharpe,
        composite_score: c.compositeScore,
        score_rank: c.scoreRank,
        raw_score_wt: c.rawScoreWt,
        equal_wt_base: c.equalWtBase,
        vol_cap_flag: c.volCapFlag,
        theme_exposure_pct: c.themeExposurePct,
        theme_capped_wt: c.themeCappedWt,
        final_target_wt: c.finalTargetWt,
        signal: c.trendSignal,
        ret_3mo: c.ret3mo,
        ret_6mo: c.ret6mo,
        ret_1yr: c.ret1yr,
        ret_3yr: c.ret3yr,
        ret_5yr: c.ret5yr,
        price_3mo: c.price3mo,
        price_6mo: c.price6mo,
        price_1yr: c.price1yr,
        price_3yr: c.price3yr,
        price_5yr: c.price5yr,
      });
    }
  }

  // Process income sleeves (uses mainNAV as denominator)
  for (const sleeve of sleeves as SleeveRow[]) {
    if (sleeve.weighting_method !== "YIELD_PROPORTIONAL") continue;

    const holdings = allHoldings.filter((h) => h.sleeve_id === sleeve.id);
    const incomeInputs: IncomeHoldingInput[] = holdings.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      qty: Number(h.qty),
      price: currentPrices[h.ticker] ?? Number(h.price_seed),
      divDollar: Number(h.div_dollar),
      expenseRatio: Number(h.expense_ratio),
    }));

    const totalNAV = mainNAV || 1;
    const incomeResult = computeIncomeSleeve(incomeInputs, assumptions.incomeBudgetPct, totalNAV);
    mainNAV += incomeResult.reduce((s, h) => s + h.value, 0);

    for (const c of incomeResult) {
      snapshotsToInsert.push({
        holding_id: c.id,
        date: today,
        price: c.price,
        value: c.value,
        div_apy: c.divAPY,
        current_wt_pct: c.currentWtPct,
        target_wt_pct: c.targetWtPct,
        parity_gap_pct: c.parityGapPct,
        parity_dollar: c.parityDollarChg,
        parity_dollar_amt: c.parityDollarAmt,
        parity_dollar_chg: c.parityDollarChg,
        blended_return: 0,
        vol_3mo: 0,
        sharpe_proxy: 0,
        pr_expense: 0,
        pr_return: 0,
        pr_div_apy: 0,
        pr_sharpe: 0,
        composite_score: 0,
        score_rank: null,
        raw_score_wt: 0,
        equal_wt_base: 0,
        vol_cap_flag: "N/A",
        theme_exposure_pct: 0,
        theme_capped_wt: 0,
        final_target_wt: c.finalTargetWt,
        signal: "Hold",
        ret_3mo: 0,
        ret_6mo: 0,
        ret_1yr: 0,
        ret_3yr: 0,
        ret_5yr: 0,
        price_3mo: 0,
        price_6mo: 0,
        price_1yr: 0,
        price_3yr: 0,
        price_5yr: 0,
      });
    }
  }

  // MANUAL sleeves — no computation, just write a passthrough snapshot
  for (const sleeve of sleeves as SleeveRow[]) {
    if (sleeve.weighting_method !== "MANUAL") continue;

    const holdings = allHoldings.filter((h) => h.sleeve_id === sleeve.id);
    for (const h of holdings) {
      const price = Number(h.price_seed);
      const value = Number(h.qty) * price;
      const target = h.manual_target_wt ?? 0;

      snapshotsToInsert.push({
        holding_id: h.id,
        date: today,
        price,
        value,
        div_apy: 0,
        current_wt_pct: 0,
        target_wt_pct: target,
        parity_gap_pct: 0,
        parity_dollar: 0,
        parity_dollar_amt: 0,
        parity_dollar_chg: 0,
        blended_return: 0,
        vol_3mo: 0,
        sharpe_proxy: 0,
        pr_expense: 0,
        pr_return: 0,
        pr_div_apy: 0,
        pr_sharpe: 0,
        composite_score: 0,
        score_rank: null,
        raw_score_wt: 0,
        equal_wt_base: 0,
        vol_cap_flag: "N/A",
        theme_exposure_pct: 0,
        theme_capped_wt: 0,
        final_target_wt: target,
        signal: "Hold",
        ret_3mo: 0,
        ret_6mo: 0,
        ret_1yr: 0,
        ret_3yr: 0,
        ret_5yr: 0,
        price_3mo: 0,
        price_6mo: 0,
        price_1yr: 0,
        price_3yr: 0,
        price_5yr: 0,
      });
    }
  }

  if (snapshotsToInsert.length > 0) {
    await supabase.from("sleeve_snapshots").insert(snapshotsToInsert);
  }

  revalidatePath(`/portfolio/sleeves`);

  return {
    success: true,
    totalNAV: mainNAV,
    holdingsProcessed: snapshotsToInsert.length,
  };
}
