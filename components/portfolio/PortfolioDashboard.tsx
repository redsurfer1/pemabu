"use client";

import { useState, useCallback, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SleeveManager } from "./SleeveManager";
import type { SleeveDisplayData } from "./SleeveManager";
import { AssumptionsPanel } from "./AssumptionsPanel";
import type { EngineAssumptions, SleevePurpose, ComputedHolding, HoldingInput } from "@/types/allocation";
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
}

export function PortfolioDashboard({ portfolioId, portfolioName }: PortfolioDashboardProps) {
  const [sleeves, setSleeves] = useState<SleeveDisplayData[]>([]);
  /** Main-sleeve scoring assumptions (shown in AssumptionsPanel). */
  const [assumptions, setAssumptions] = useState<EngineAssumptions>(DEFAULT_ENGINE_ASSUMPTIONS);
  /** Income-sleeve assumptions — loaded separately from model_assumptions where sleeve_type='income'. */
  const [incomeAssumptions, setIncomeAssumptions] = useState<EngineAssumptions>(DEFAULT_ENGINE_ASSUMPTIONS);
  const [totalNAV, setTotalNAV] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = getSupabaseBrowserClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    // Load per-sleeve assumptions (one row per sleeve_type since phase-1 migration).
    const { data: assumptionRows } = await supabase
      .from("model_assumptions")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .in("sleeve_type", ["main", "income"]);

    function rowToAssumptions(row: Record<string, unknown>): EngineAssumptions {
      return {
        retWeight3mo: Number(row.ret_weight_3mo),
        retWeight6mo: Number(row.ret_weight_6mo),
        retWeight1yr: Number(row.ret_weight_1yr),
        retWeight3yr: Number(row.ret_weight_3yr),
        retWeight5yr: Number(row.ret_weight_5yr),
        scoreWeightExp: Number(row.score_weight_exp),
        scoreWeightRet: Number(row.score_weight_ret),
        scoreWeightDiv: Number(row.score_weight_div),
        scoreWeightShp: Number(row.score_weight_shp),
        incomeBudgetPct: Number(row.income_budget_pct),
        volCapMultiplier: Number(row.vol_cap_multiplier),
        themeCapPct: Number(row.theme_cap_pct),
      };
    }

    const mainRow = (assumptionRows ?? []).find(
      (r: Record<string, unknown>) => r.sleeve_type === "main",
    );
    const incomeRow = (assumptionRows ?? []).find(
      (r: Record<string, unknown>) => r.sleeve_type === "income",
    );

    const a: EngineAssumptions = mainRow ? rowToAssumptions(mainRow) : DEFAULT_ENGINE_ASSUMPTIONS;
    const aIncome: EngineAssumptions = incomeRow ? rowToAssumptions(incomeRow) : DEFAULT_ENGINE_ASSUMPTIONS;
    setAssumptions(a);
    setIncomeAssumptions(aIncome);

    // Load sleeves
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

    // Load all holdings
    const sleeveIds = (sleeveRows as SleeveRow[]).map((s) => s.id);
    const { data: holdingRows } = await supabase
      .from("sleeve_holdings")
      .select("*")
      .in("sleeve_id", sleeveIds);

    const allHoldings = (holdingRows ?? []) as HoldingRow[];

    // Compute each sleeve
    let nav = 0;
    const computedSleeves: SleeveDisplayData[] = [];

    for (const sleeve of sleeveRows as SleeveRow[]) {
      const holdings = allHoldings.filter((h) => h.sleeve_id === sleeve.id);

      if (sleeve.purpose === "Appreciation" || sleeve.purpose === "Growth") {
        const inputs: HoldingInput[] = holdings.map((h) => ({
          ticker: h.ticker,
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

        const signalSummary = {
          entry: result.holdings.filter((h) => h.trendSignal === "Consider Entry").length,
          hold: result.holdings.filter((h) => h.trendSignal === "Hold").length,
          exit: result.holdings.filter((h) => h.trendSignal === "Consider Exit").length,
        };

        computedSleeves.push({
          id: sleeve.id,
          name: sleeve.name,
          purpose: sleeve.purpose as SleevePurpose,
          budgetPct: Number(sleeve.budget_pct),
          sortOrder: sleeve.sort_order,
          holdings: result.holdings,
          subtotalValue: result.totalValue,
          subtotalTargetPct: Number(sleeve.budget_pct),
          signalSummary,
        });
      } else if (sleeve.purpose === "Income") {
        const incomeInputs: IncomeHoldingInput[] = holdings.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          qty: Number(h.qty),
          price: Number(h.price_seed),
          divDollar: Number(h.div_dollar),
        }));

        const incomeResult = computeIncomeSleeve(incomeInputs, aIncome.incomeBudgetPct, nav || 1);
        const sleeveValue = incomeResult.reduce((s, h) => s + h.value, 0);
        nav += sleeveValue;

        const incomeHoldings: ComputedHolding[] = incomeResult.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          status: "Active" as const,
          theme: "Dividend" as const,
          qty: h.qty,
          price: h.price,
          value: h.value,
          expenseRatio: 0,
          divDollar: h.qty * h.price * h.divAPY,
          divAPY: h.divAPY,
          currentWtPct: h.currentWtPct,
          targetWtPct: h.targetWtPct,
          parityGapPct: 0,
          parityDollarChg: h.parityDollarChg,
          ret3mo: 0, ret6mo: 0, ret1yr: 0, ret3yr: 0, ret5yr: 0,
          blendedReturn: 0, vol3mo: 0, sharpeProxy: 0,
          prExpense: 0, prReturn: 0, prDivAPY: 0, prSharpe: 0,
          compositeScore: 0, scoreRank: null, rawScoreWt: 0, equalWtBase: 0,
          volCapFlag: "N/A" as const,
          themeExposurePct: 0,
          trendSignal: "Hold" as const,
        }));

        computedSleeves.push({
          id: sleeve.id,
          name: sleeve.name,
          purpose: "Income",
          budgetPct: Number(sleeve.budget_pct),
          sortOrder: sleeve.sort_order,
          holdings: incomeHoldings,
          subtotalValue: sleeveValue,
          subtotalTargetPct: Number(sleeve.budget_pct),
          signalSummary: { entry: 0, hold: incomeHoldings.length, exit: 0 },
        });
      } else {
        // Stability / Fidelity / Custom — manual pricing
        const manualHoldings: ComputedHolding[] = holdings.map((h) => ({
          ticker: h.ticker,
          name: h.name,
          status: "Active" as const,
          theme: "Broad" as const,
          qty: Number(h.qty),
          price: Number(h.price_seed),
          value: Number(h.qty) * Number(h.price_seed),
          expenseRatio: Number(h.expense_ratio),
          divDollar: Number(h.div_dollar),
          divAPY: 0,
          currentWtPct: 0,
          targetWtPct: Number(h.target_wt_pct),
          parityGapPct: 0,
          parityDollarChg: 0,
          ret3mo: 0, ret6mo: 0, ret1yr: 0, ret3yr: 0, ret5yr: 0,
          blendedReturn: 0, vol3mo: 0, sharpeProxy: 0,
          prExpense: 0, prReturn: 0, prDivAPY: 0, prSharpe: 0,
          compositeScore: 0, scoreRank: null, rawScoreWt: 0, equalWtBase: 0,
          volCapFlag: "N/A" as const,
          themeExposurePct: 0,
          trendSignal: "Hold" as const,
        }));

        const sleeveValue = manualHoldings.reduce((s, h) => s + h.value, 0);
        nav += sleeveValue;

        computedSleeves.push({
          id: sleeve.id,
          name: sleeve.name,
          purpose: sleeve.purpose as SleevePurpose,
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

  async function handleRefreshPrices() {
    setRefreshing(true);
    try {
      const { refreshPrices } = await import("@/lib/actions/refreshPrices");
      await refreshPrices(portfolioId);
      setLastRefreshed(new Date());
      await loadData();
    } finally {
      setRefreshing(false);
      setRefreshCooldown(true);
      setTimeout(() => setRefreshCooldown(false), 60_000);
    }
  }

  async function handleAddSleeve(data: { name: string; purpose: SleevePurpose; budgetPct: number }) {
    const maxOrder = sleeves.reduce((m, s) => Math.max(m, s.sortOrder), 0);
    await supabase.from("sleeves").insert({
      portfolio_id: portfolioId,
      name: data.name,
      purpose: data.purpose,
      budget_pct: data.budgetPct,
      sort_order: maxOrder + 1,
      is_active: true,
    });
    await loadData();
  }

  async function handleRemoveSleeve(sleeveId: string) {
    const { removeSleeve } = await import("@/lib/actions/portfolio/removeSleeve");
    const res = await removeSleeve(sleeveId);
    if (!res.success) {
      console.warn(res.error);
      return;
    }
    await loadData();
  }

  async function handleSaveAssumptions(updated: EngineAssumptions) {
    setIsRecomputing(true);
    // Upsert main-sleeve assumptions. onConflict targets the (portfolio_id, sleeve_type)
    // unique index added by the phase-1 migration.
    await supabase.from("model_assumptions").upsert(
      {
        portfolio_id: portfolioId,
        sleeve_type: "main",
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
      { onConflict: "portfolio_id,sleeve_type" },
    );
    setAssumptions(updated);
    await loadData();
    setIsRecomputing(false);
  }

  // KPI calculations
  const activeETFCount = sleeves.reduce(
    (s, sl) => s + sl.holdings.filter((h) => h.status === "Active").length, 0,
  );
  const allActive = sleeves.flatMap((sl) => sl.holdings.filter((h) => h.status === "Active"));
  const weightedExpense = totalNAV > 0
    ? allActive.reduce((s, h) => s + h.expenseRatio * h.value, 0) / totalNAV
    : 0;
  const weightedDivYield = totalNAV > 0
    ? allActive.reduce((s, h) => s + h.divAPY * h.value, 0) / totalNAV
    : 0;
  const cappedCount = allActive.filter((h) => h.volCapFlag === "CAPPED").length;

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
      <div className="flex items-center justify-between">
        <h1 className="font-[Georgia,serif] text-xl text-white">{portfolioName}</h1>
        <div className="flex items-center gap-3">
          <AssumptionsPanel
            assumptions={assumptions}
            onSave={handleSaveAssumptions}
            isRecomputing={isRecomputing}
          />
          <button
            type="button"
            onClick={() => void handleRefreshPrices()}
            disabled={refreshing || refreshCooldown}
            className="rounded bg-[#C9A84C] px-4 py-1.5 text-xs font-medium text-[#0D1B2A] transition-colors hover:bg-[#C9A84C]/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh Prices"}
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-[#0D1B2A]/80 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Total NAV</p>
          <p className="text-lg font-medium text-white">
            ${totalNAV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Active ETFs</p>
          <p className="text-lg font-medium text-white">{activeETFCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Wtd Expense</p>
          <p className="text-lg font-medium text-white">{(weightedExpense * 100).toFixed(3)}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Wtd Div Yield</p>
          <p className="text-lg font-medium text-emerald-400">{(weightedDivYield * 100).toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Capped Positions</p>
          <p className="text-lg font-medium text-amber-400">{cappedCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Last Refreshed</p>
          <p className="text-sm text-gray-300">
            {lastRefreshed ? lastRefreshed.toLocaleTimeString() : "Never"}
          </p>
        </div>
      </div>

      {/* Sleeve Summary Strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sleeves.map((sl) => {
          const pctNAV = totalNAV > 0 ? (sl.subtotalValue / totalNAV) * 100 : 0;
          return (
            <div key={sl.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white">{sl.name}</span>
                <span className="text-[10px] text-gray-500">{sl.purpose}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Budget: {(sl.budgetPct * 100).toFixed(0)}%</span>
                <span className="text-white">${sl.subtotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              {/* Parity bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#C9A84C] transition-all"
                  style={{ width: `${Math.min(pctNAV, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-500 text-right">{pctNAV.toFixed(1)}% of NAV</p>
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

      {/* Portfolio Total */}
      <div className="rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#C9A84C]">Total Portfolio NAV</span>
          <span className="text-lg font-medium text-white">
            ${totalNAV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
