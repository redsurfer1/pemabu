"use client";

import { useState, useCallback, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SleeveManager } from "./SleeveManager";
import type { SleeveDisplayData } from "./SleeveManager";
import { AssumptionsPanel } from "./AssumptionsPanel";
import { PortfolioKPIBar } from "./PortfolioKPIBar";
import { RefreshButton } from "./RefreshButton";
import type {
  EngineAssumptions,
  SleevePurpose,
  SleeveWeightingMethod,
  ComputedHolding,
  HoldingInput,
  PortfolioKPIs,
} from "@/types/allocation";
import { DEFAULT_ENGINE_ASSUMPTIONS } from "@/types/allocation";
import { computeMainSleeve, computeIncomeSleeve } from "@/lib/allocation/v3-engine";
import type { IncomeHoldingInput } from "@/lib/allocation/v3-engine";

interface PortfolioDashboardProps {
  portfolioId: string;
  portfolioName: string;
}

interface SleeveRow {
  id: string;
  name: string;
  purpose: string;
  weighting_method: string;
  budget_pct: number;
  sort_order: number;
  is_active: boolean;
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
  manual_pricing: boolean;
  manual_target_wt: number | null;
}

export function PortfolioDashboard({ portfolioId, portfolioName }: PortfolioDashboardProps) {
  const [sleeves, setSleeves] = useState<SleeveDisplayData[]>([]);
  const [assumptions, setAssumptions] = useState<EngineAssumptions>(DEFAULT_ENGINE_ASSUMPTIONS);
  const [totalNAV, setTotalNAV] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabaseBrowserClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: assumptionsRow } = await supabase
      .from("model_assumptions")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .maybeSingle();

    const a: EngineAssumptions = assumptionsRow
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
    setAssumptions(a);

    const { data: sleeveRows } = await supabase
      .from("sleeves")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .eq("is_active", true)
      .order("sort_order");

    if (!sleeveRows?.length) {
      setSleeves([]);
      setLoading(false);
      return;
    }

    const sleeveIds = (sleeveRows as SleeveRow[]).map((s) => s.id);
    const { data: holdingRows } = await supabase
      .from("sleeve_holdings")
      .select("*")
      .in("sleeve_id", sleeveIds);

    const allHoldings = (holdingRows ?? []) as HoldingRow[];

    let nav = 0;
    const computedSleeves: SleeveDisplayData[] = [];

    for (const sleeve of sleeveRows as SleeveRow[]) {
      const holdings = allHoldings.filter((h) => h.sleeve_id === sleeve.id);
      const weightingMethod = (sleeve.weighting_method ?? "COMPOSITE_SCORE") as SleeveWeightingMethod;

      if (weightingMethod === "COMPOSITE_SCORE") {
        const inputs: HoldingInput[] = holdings.map((h) => ({
          id: h.id,
          ticker: h.ticker,
          name: h.name,
          status: h.status as "Active" | "Comparable",
          theme: h.theme,
          qty: Number(h.qty),
          price: Number(h.price_seed),
          expenseRatio: Number(h.expense_ratio),
          divDollar: Number(h.div_dollar),
          price3mo: 0,
          price6mo: 0,
          price1yr: 0,
          price3yr: 0,
          price5yr: 0,
        }));

        const result = computeMainSleeve(inputs, a);
        nav += result.totalValue;

        const ss = result.holdings.filter((h) => h.status === "Active");
        computedSleeves.push({
          id: sleeve.id,
          name: sleeve.name,
          purpose: sleeve.purpose as SleevePurpose,
          weightingMethod,
          budgetPct: Number(sleeve.budget_pct),
          sortOrder: sleeve.sort_order,
          holdings: result.holdings,
          subtotalValue: result.totalValue,
          subtotalTargetPct: Number(sleeve.budget_pct),
          signalSummary: {
            entry: ss.filter((h) => h.trendSignal === "Consider Entry").length,
            hold: ss.filter((h) => h.trendSignal === "Hold").length,
            exit: ss.filter((h) => h.trendSignal === "Consider Exit").length,
          },
        });
      } else if (weightingMethod === "YIELD_PROPORTIONAL") {
        const incomeInputs: IncomeHoldingInput[] = holdings.map((h) => ({
          id: h.id,
          ticker: h.ticker,
          name: h.name,
          qty: Number(h.qty),
          price: Number(h.price_seed),
          divDollar: Number(h.div_dollar),
          expenseRatio: Number(h.expense_ratio),
        }));

        const incomeResult = computeIncomeSleeve(incomeInputs, a.incomeBudgetPct, nav || 1);
        const sleeveValue = incomeResult.reduce((s, h) => s + h.value, 0);
        nav += sleeveValue;

        computedSleeves.push({
          id: sleeve.id,
          name: sleeve.name,
          purpose: "Income",
          weightingMethod,
          budgetPct: Number(sleeve.budget_pct),
          sortOrder: sleeve.sort_order,
          holdings: incomeResult,
          subtotalValue: sleeveValue,
          subtotalTargetPct: Number(sleeve.budget_pct),
          signalSummary: { entry: 0, hold: incomeResult.length, exit: 0 },
        });
      } else {
        // MANUAL
        const manualHoldings: ComputedHolding[] = holdings.map((h) => {
          const value = Number(h.qty) * Number(h.price_seed);
          const target = h.manual_target_wt ?? Number(h.target_wt_pct) ?? 0;
          return {
            id: h.id,
            ticker: h.ticker,
            name: h.name,
            status: "Active" as const,
            theme: "Broad" as const,
            qty: Number(h.qty),
            price: Number(h.price_seed),
            value,
            expenseRatio: Number(h.expense_ratio),
            divDollar: Number(h.div_dollar),
            divAPY: 0,
            price3mo: 0, price6mo: 0, price1yr: 0, price3yr: 0, price5yr: 0,
            ret3mo: 0, ret6mo: 0, ret1yr: 0, ret3yr: 0, ret5yr: 0,
            blendedReturn: 0, vol3mo: 0, sharpeProxy: 0,
            prExpense: 0, prReturn: 0, prDivAPY: 0, prSharpe: 0,
            compositeScore: 0, scoreRank: null, rawScoreWt: 0, equalWtBase: 0,
            volCapFlag: "N/A" as const,
            themeExposurePct: 0, themeCappedWt: 0, finalTargetWt: target,
            parityDollarAmt: 0, parityDollarChg: 0,
            currentWtPct: 0, targetWtPct: target, parityGapPct: 0,
            trendSignal: "Hold" as const,
          };
        });

        const sleeveValue = manualHoldings.reduce((s, h) => s + h.value, 0);
        nav += sleeveValue;

        computedSleeves.push({
          id: sleeve.id,
          name: sleeve.name,
          purpose: sleeve.purpose as SleevePurpose,
          weightingMethod,
          budgetPct: Number(sleeve.budget_pct),
          sortOrder: sleeve.sort_order,
          holdings: manualHoldings,
          subtotalValue: sleeveValue,
          subtotalTargetPct: Number(sleeve.budget_pct),
          signalSummary: { entry: 0, hold: manualHoldings.length, exit: 0 },
        });
      }
    }

    setTotalNAV(nav);
    setSleeves(computedSleeves);
    setLoading(false);
  }, [portfolioId, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function handleAddSleeve(data: {
    name: string;
    purpose: SleevePurpose;
    weightingMethod: SleeveWeightingMethod;
    budgetPct: number;
    description: string;
  }) {
    const maxOrder = sleeves.reduce((m, s) => Math.max(m, s.sortOrder), 0);
    await supabase.from("sleeves").insert({
      portfolio_id: portfolioId,
      name: data.name,
      purpose: data.purpose,
      weighting_method: data.weightingMethod,
      budget_pct: data.budgetPct,
      sort_order: maxOrder + 1,
      is_active: true,
    });
    await loadData();
  }

  async function handleRemoveSleeve(sleeveId: string) {
    await supabase.from("sleeves").update({ is_active: false }).eq("id", sleeveId);
    await loadData();
  }

  async function handleSaveAssumptions(updated: EngineAssumptions) {
    setIsRecomputing(true);
    await supabase.from("model_assumptions").upsert(
      {
        portfolio_id: portfolioId,
        ret_weight_3mo: updated.retWeight3mo,
        ret_weight_6mo: updated.retWeight6mo,
        ret_weight_1yr: updated.retWeight1yr,
        ret_weight_3yr: updated.retWeight3yr,
        ret_weight_5yr: updated.retWeight5yr,
        score_weight_exp: updated.scoreWeightExp,
        score_weight_ret: updated.scoreWeightRet,
        score_weight_div: updated.scoreWeightDiv,
        score_weight_shp: updated.scoreWeightShp,
        income_budget_pct: updated.incomeBudgetPct,
        vol_cap_multiplier: updated.volCapMultiplier,
        theme_cap_pct: updated.themeCapPct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "portfolio_id" },
    );
    setAssumptions(updated);
    await loadData();
    setIsRecomputing(false);
  }

  // KPI calculations
  const allActive = sleeves.flatMap((sl) => sl.holdings.filter((h) => h.status === "Active"));
  const mainSleeve = sleeves.find((s) => s.weightingMethod === "COMPOSITE_SCORE");
  const incomeSleeve = sleeves.find((s) => s.weightingMethod === "YIELD_PROPORTIONAL");
  const weightedExpenseRatio =
    totalNAV > 0
      ? allActive.reduce((s, h) => s + h.expenseRatio * h.value, 0) / totalNAV
      : 0;
  const weightedDivYield =
    totalNAV > 0
      ? allActive.reduce((s, h) => s + h.divAPY * h.value, 0) / totalNAV
      : 0;
  const cappedCount = allActive.filter((h) => h.volCapFlag === "CAPPED").length;

  const kpis: PortfolioKPIs = {
    totalNAV,
    activeETFCount: allActive.filter((h) =>
      sleeves.find((s) => s.id === (sleeves.find((sl) => sl.holdings.includes(h))?.id))
        ?.weightingMethod === "COMPOSITE_SCORE"
    ).length,
    weightedExpenseRatio,
    weightedDivYield,
    mainSleevePct: mainSleeve ? mainSleeve.subtotalValue / Math.max(totalNAV, 1) : 0,
    incomeSleevePct: incomeSleeve ? incomeSleeve.subtotalValue / Math.max(totalNAV, 1) : 0,
    cappedPositionCount: cappedCount,
    lastRefreshed,
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
          <p className="text-xs text-gray-500">Loading allocation data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-[Georgia,serif] text-xl text-white">{portfolioName}</h1>
        <div className="flex items-center gap-3">
          <AssumptionsPanel
            assumptions={assumptions}
            onSave={handleSaveAssumptions}
            isRecomputing={isRecomputing}
          />
          <RefreshButton
            portfolioId={portfolioId}
            onRefreshed={(nav) => {
              setLastRefreshed(new Date());
              setTotalNAV(nav);
              void loadData();
            }}
          />
        </div>
      </div>

      {/* KPI Bar */}
      <PortfolioKPIBar kpis={kpis} />

      {/* Sleeve Summary Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sleeves.map((sl) => {
          const pctNAV = totalNAV > 0 ? (sl.subtotalValue / totalNAV) * 100 : 0;
          return (
            <div key={sl.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-white">{sl.name}</span>
                <span className="text-[10px] text-gray-500">{sl.purpose}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Budget: {(sl.budgetPct * 100).toFixed(0)}%</span>
                <span className="text-white">
                  ${sl.subtotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#C9A84C] transition-all"
                  style={{ width: `${Math.min(pctNAV, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[10px] text-gray-500">{pctNAV.toFixed(1)}% of NAV</p>
            </div>
          );
        })}
      </div>

      {/* Sleeve Cards */}
      <SleeveManager
        sleeves={sleeves}
        totalPortfolioNAV={totalNAV}
        onAddSleeve={handleAddSleeve}
        onRemoveSleeve={handleRemoveSleeve}
      />

      {/* Portfolio Total Footer */}
      <div className="rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#C9A84C]">Total Portfolio NAV</span>
          <span className="text-lg font-medium text-white">
            $
            {totalNAV.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
