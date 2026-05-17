"use server";

import { createClient } from "@/lib/supabase/server";
import {
  computeMainSleeve,
  computeIncomeSleeve,
} from "@/lib/allocation/v3-engine";
import type { IncomeHoldingInput } from "@/lib/allocation/v3-engine";
import type { EngineAssumptions, HoldingInput } from "@/types/allocation";
import { DEFAULT_ENGINE_ASSUMPTIONS } from "@/types/allocation";

interface SleeveRow {
  id: string;
  purpose: string;
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
}

async function fetchCurrentPrices(tickers: string[]): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};
  const params = new URLSearchParams({ tickers: tickers.join(",") });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/prices/current?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) return {};
  return res.json();
}

async function fetchHistoricalPrices(
  tickers: string[],
): Promise<Record<string, Record<string, number>>> {
  if (tickers.length === 0) return {};
  const params = new URLSearchParams({ tickers: tickers.join(",") });
  const res = await fetch(
    `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/prices/historical?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) return {};
  return res.json();
}

export async function refreshPrices(portfolioId: string) {
  const supabase = await createClient();

  const { getModelAssumptionsForPortfolio } = await import("@/lib/portfolio/model-assumptions-store");
  const assumptions = (await getModelAssumptionsForPortfolio(portfolioId)).main;

  // Load sleeves
  const { data: sleeves } = await supabase
    .from("sleeves")
    .select("id, purpose")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true)
    .order("sort_order");

  if (!sleeves?.length) return { success: false, error: "No sleeves found" };

  // Load all holdings across sleeves
  const sleeveIds = sleeves.map((s: SleeveRow) => s.id);
  const { data: allHoldings } = await supabase
    .from("sleeve_holdings")
    .select("*")
    .in("sleeve_id", sleeveIds);

  if (!allHoldings?.length) return { success: false, error: "No holdings found" };

  // Identify tickers that need pricing (exclude Stability/manual sleeves)
  const stabilitySleeveIds = new Set(
    sleeves.filter((s: SleeveRow) => s.purpose === "Stability").map((s: SleeveRow) => s.id),
  );
  const priceable = (allHoldings as HoldingRow[]).filter(
    (h) => !stabilitySleeveIds.has(h.sleeve_id),
  );
  const uniqueTickers = [...new Set(priceable.map((h) => h.ticker))];

  // Fetch prices in parallel
  const [currentPrices, historicalPrices] = await Promise.all([
    fetchCurrentPrices(uniqueTickers),
    fetchHistoricalPrices(uniqueTickers),
  ]);

  // Process Main (Appreciation) sleeve
  const mainSleeves = sleeves.filter((s: SleeveRow) => s.purpose === "Appreciation");
  const incomeSleeves = sleeves.filter((s: SleeveRow) => s.purpose === "Income");

  let totalNAV = 0;
  const snapshotsToInsert: Array<Record<string, unknown>> = [];

  for (const sleeve of mainSleeves) {
    const holdings = (allHoldings as HoldingRow[]).filter(
      (h) => h.sleeve_id === (sleeve as SleeveRow).id,
    );

    const inputs: HoldingInput[] = holdings.map((h) => {
      const price = currentPrices[h.ticker] ?? h.price_seed;
      const hist = historicalPrices[h.ticker] ?? {};
      return {
        ticker: h.ticker,
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
    totalNAV += result.totalValue;

    // Update price_seed on holdings
    for (const h of holdings) {
      const price = currentPrices[h.ticker];
      if (price != null) {
        await supabase
          .from("sleeve_holdings")
          .update({ price_seed: price, updated_at: new Date().toISOString() })
          .eq("id", h.id);
      }
    }

    // Build snapshots
    for (const computed of result.holdings) {
      const holdingRow = holdings.find((h) => h.ticker === computed.ticker);
      if (!holdingRow) continue;
      const hist = historicalPrices[computed.ticker] ?? {};

      snapshotsToInsert.push({
        holding_id: holdingRow.id,
        date: new Date().toISOString().slice(0, 10),
        price: computed.price,
        value: computed.value,
        current_wt_pct: computed.currentWtPct,
        target_wt_pct: computed.targetWtPct,
        parity_gap_pct: computed.parityGapPct,
        parity_dollar: computed.parityDollarChg,
        blended_return: computed.blendedReturn,
        composite_score: computed.compositeScore,
        score_rank: computed.scoreRank,
        vol_cap_flag: computed.volCapFlag,
        theme_exposure_pct: computed.themeExposurePct,
        signal: computed.trendSignal,
        ret_3mo: computed.ret3mo,
        ret_6mo: computed.ret6mo,
        ret_1yr: computed.ret1yr,
        ret_3yr: computed.ret3yr,
        ret_5yr: computed.ret5yr,
        price_3mo: hist["3mo"] ?? 0,
        price_6mo: hist["6mo"] ?? 0,
        price_1yr: hist["1yr"] ?? 0,
        price_3yr: hist["3yr"] ?? 0,
        price_5yr: hist["5yr"] ?? 0,
      });
    }
  }

  // Process Income sleeves
  for (const sleeve of incomeSleeves) {
    const holdings = (allHoldings as HoldingRow[]).filter(
      (h) => h.sleeve_id === (sleeve as SleeveRow).id,
    );

    const incomeInputs: IncomeHoldingInput[] = holdings.map((h) => ({
      ticker: h.ticker,
      name: h.name,
      qty: Number(h.qty),
      price: currentPrices[h.ticker] ?? h.price_seed,
      divDollar: Number(h.div_dollar),
    }));

    const incomeResult = computeIncomeSleeve(
      incomeInputs,
      assumptions.incomeBudgetPct,
      totalNAV,
    );
    totalNAV += incomeResult.reduce((s, h) => s + h.value, 0);

    for (const h of holdings) {
      const price = currentPrices[h.ticker];
      if (price != null) {
        await supabase
          .from("sleeve_holdings")
          .update({ price_seed: price, updated_at: new Date().toISOString() })
          .eq("id", h.id);
      }
    }

    for (const computed of incomeResult) {
      const holdingRow = holdings.find((h) => h.ticker === computed.ticker);
      if (!holdingRow) continue;

      snapshotsToInsert.push({
        holding_id: holdingRow.id,
        date: new Date().toISOString().slice(0, 10),
        price: computed.price,
        value: computed.value,
        current_wt_pct: computed.currentWtPct,
        target_wt_pct: computed.targetWtPct,
        parity_gap_pct: 0,
        parity_dollar: computed.parityDollarChg,
        blended_return: 0,
        composite_score: 0,
        score_rank: null,
        vol_cap_flag: "N/A",
        theme_exposure_pct: 0,
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

  // Write snapshots
  if (snapshotsToInsert.length > 0) {
    await supabase.from("sleeve_snapshots").insert(snapshotsToInsert);
  }

  return { success: true, totalNAV, holdingsProcessed: snapshotsToInsert.length };
}
