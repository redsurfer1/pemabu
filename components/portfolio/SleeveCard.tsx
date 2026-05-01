"use client";

import { useState } from "react";
import type { ComputedHolding, SleevePurpose } from "@/types/allocation";
import { HoldingsTable } from "./HoldingsTable";

interface SleeveCardProps {
  sleeve: {
    id: string;
    name: string;
    purpose: SleevePurpose;
    budgetPct: number;
    holdings: ComputedHolding[];
    subtotalValue: number;
    subtotalTargetPct: number;
    signalSummary: { entry: number; hold: number; exit: number };
  };
  totalPortfolioNAV: number;
  onRemove?: () => void;
  onEdit?: () => void;
}

const PURPOSE_COLORS: Record<SleevePurpose, string> = {
  Appreciation: "bg-[#0D1B2A] text-[#F5F5F3] border-[#0D1B2A]",
  Income: "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30",
  Stability: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  Growth: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  Custom: "bg-white/10 text-gray-300 border-white/20",
};

function getSleeveType(purpose: SleevePurpose): "main" | "income" | "fidelity" {
  if (purpose === "Appreciation" || purpose === "Growth") return "main";
  if (purpose === "Income") return "income";
  return "fidelity";
}

export function SleeveCard({ sleeve, totalPortfolioNAV, onRemove }: SleeveCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pctOfNAV = totalPortfolioNAV > 0 ? (sleeve.subtotalValue / totalPortfolioNAV) * 100 : 0;
  const sleeveType = getSleeveType(sleeve.purpose);

  const activeHoldings = sleeve.holdings.filter((h) => h.status === "Active");
  const weightedExpense = activeHoldings.length > 0
    ? activeHoldings.reduce((s, h) => s + h.expenseRatio * h.value, 0) /
      Math.max(activeHoldings.reduce((s, h) => s + h.value, 0), 1)
    : 0;
  const weightedYield = activeHoldings.length > 0
    ? activeHoldings.reduce((s, h) => s + h.divAPY * h.value, 0) /
      Math.max(activeHoldings.reduce((s, h) => s + h.value, 0), 1)
    : 0;

  return (
    <div className="rounded-lg border border-white/10 bg-[#0D1B2A]/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-white transition-colors text-xs"
          >
            {collapsed ? "+" : "\u2212"}
          </button>
          <h3 className="text-sm font-semibold text-white font-[Georgia,serif]">{sleeve.name}</h3>
          <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium ${PURPOSE_COLORS[sleeve.purpose]}`}>
            {sleeve.purpose}
          </span>
          <span className="text-xs text-gray-500">
            Budget: {(sleeve.budgetPct * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">Subtotal</p>
            <p className="text-sm font-medium text-white">
              ${sleeve.subtotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">% NAV</p>
            <p className="text-sm text-gray-300">{pctOfNAV.toFixed(1)}%</p>
          </div>
          <div className="flex gap-1">
            <span className="text-[10px] text-emerald-400">{sleeve.signalSummary.entry}E</span>
            <span className="text-[10px] text-gray-400">{sleeve.signalSummary.hold}H</span>
            <span className="text-[10px] text-red-400">{sleeve.signalSummary.exit}X</span>
          </div>
          {onRemove && (
            confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onRemove}
                  className="rounded border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/10"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 text-[10px] text-gray-500 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                title="Remove sleeve"
              >
                Remove
              </button>
            )
          )}
        </div>
      </div>

      {/* Subtotals bar */}
      {!collapsed && (
        <div className="flex items-center gap-6 border-b border-white/5 px-4 py-2 text-[10px] text-gray-500">
          <span>Holdings: <span className="text-gray-300">{activeHoldings.length}</span></span>
          <span>Wtd Expense: <span className="text-gray-300">{(weightedExpense * 100).toFixed(3)}%</span></span>
          <span>Wtd Yield: <span className="text-emerald-400">{(weightedYield * 100).toFixed(2)}%</span></span>
          <span>Total Parity Gap: <span className={sleeve.holdings.reduce((s, h) => s + h.parityDollarChg, 0) < 0 ? "text-red-400" : "text-emerald-400"}>
            ${Math.abs(sleeve.holdings.reduce((s, h) => s + h.parityDollarChg, 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span></span>
        </div>
      )}

      {/* Holdings table */}
      {!collapsed && (
        <HoldingsTable
          holdings={sleeve.holdings}
          sleeveType={sleeveType}
          totalNAV={totalPortfolioNAV}
        />
      )}
    </div>
  );
}
