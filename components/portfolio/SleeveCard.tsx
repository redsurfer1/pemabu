"use client";

import { useState } from "react";
import type { ComputedHolding, SleevePurpose, SleeveWeightingMethod } from "@/types/allocation";
import { HoldingsTable } from "./HoldingsTable";

interface SleeveCardProps {
  sleeve: {
    id: string;
    name: string;
    purpose: SleevePurpose;
    budgetPct: number;
    weightingMethod: SleeveWeightingMethod;
    holdings: ComputedHolding[];
    subtotalValue: number;
    subtotalTargetPct: number;
    signalSummary: { entry: number; hold: number; exit: number } |
                   { considerEntry: number; hold: number; considerExit: number };
  };
  totalPortfolioNAV: number;
  onRemove?: () => void;
  onEdit?: () => void;
}

const PURPOSE_COLORS: Record<SleevePurpose, string> = {
  Appreciation: "bg-[#0D1B2A] text-[#C9A84C] border-[#C9A84C]/40",
  Income: "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30",
  Stability: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  Growth: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  Custom: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

const METHOD_LABELS: Record<SleeveWeightingMethod, string> = {
  COMPOSITE_SCORE: "Composite Score",
  YIELD_PROPORTIONAL: "Yield-Proportional",
  MANUAL: "Manual",
};

export function SleeveCard({ sleeve, totalPortfolioNAV, onRemove }: SleeveCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const currentPct = totalPortfolioNAV > 0 ? sleeve.subtotalValue / totalPortfolioNAV : 0;
  const targetPct = sleeve.budgetPct;

  const activeHoldings = sleeve.holdings.filter((h) => h.status === "Active");
  const sleeveActiveValue = activeHoldings.reduce((s, h) => s + h.value, 0);
  const weightedExpense =
    sleeveActiveValue > 0
      ? activeHoldings.reduce((s, h) => s + h.expenseRatio * h.value, 0) / sleeveActiveValue
      : 0;
  const weightedYield =
    sleeveActiveValue > 0
      ? activeHoldings.reduce((s, h) => s + h.divAPY * h.value, 0) / sleeveActiveValue
      : 0;
  const totalParityGap = sleeve.holdings.reduce((s, h) => s + h.parityDollarChg, 0);

  const signals = sleeve.signalSummary as Record<string, number>;
  const entryCount = signals.considerEntry ?? signals.entry ?? 0;
  const exitCount = signals.considerExit ?? signals.exit ?? 0;
  const holdCount = signals.hold ?? 0;

  // Parity bar: show currentPct vs targetPct
  const isUnder = currentPct < targetPct;
  const maxWidth = Math.max(currentPct, targetPct);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0D1B2A]/50">
      {/* Header — navy background, gold text */}
      <div className="flex items-center justify-between bg-[#0D1B2A] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-4 text-center text-gray-400 hover:text-white transition-colors text-xs"
          >
            {collapsed ? "+" : "−"}
          </button>
          <h3 className="font-[Georgia,serif] text-sm font-semibold text-[#C9A84C]">
            {sleeve.name}
          </h3>
          <span
            className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium ${PURPOSE_COLORS[sleeve.purpose]}`}
          >
            {sleeve.purpose}
          </span>
          <span className="text-[10px] text-gray-500">
            {METHOD_LABELS[sleeve.weightingMethod]}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-500">Subtotal</p>
            <p className="text-sm font-medium text-white">
              $
              {sleeve.subtotalValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500">Actual / Budget</p>
            <p className="text-sm text-gray-300">
              {(currentPct * 100).toFixed(1)}% /&nbsp;
              <span className="text-[#C9A84C]">{(targetPct * 100).toFixed(0)}%</span>
            </p>
          </div>
          <div className="flex gap-1 text-[10px]">
            <span className="text-emerald-400">{entryCount}E</span>
            <span className="text-gray-400">{holdCount}H</span>
            <span className="text-red-400">{exitCount}X</span>
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
                className="text-gray-600 transition-colors hover:text-red-400 text-xs"
                title="Remove sleeve"
              >
                Remove
              </button>
            )
          )}
        </div>
      </div>

      {/* Parity bar */}
      {!collapsed && (
        <div className="relative mx-4 my-2 h-2 overflow-hidden rounded-full bg-white/10">
          {isUnder ? (
            <>
              {/* Red fill up to current, dotted indicator at target */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-red-500/60"
                style={{ width: `${maxWidth > 0 ? (currentPct / maxWidth) * 100 : 0}%` }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-[#C9A84C]"
                style={{ left: `${maxWidth > 0 ? (targetPct / maxWidth) * 100 : 0}%` }}
              />
            </>
          ) : (
            <>
              {/* Green fill to target, amber for excess */}
              <div
                className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500/60"
                style={{ width: `${maxWidth > 0 ? (targetPct / maxWidth) * 100 : 0}%` }}
              />
              <div
                className="absolute inset-y-0 rounded-r-full bg-amber-500/60"
                style={{
                  left: `${maxWidth > 0 ? (targetPct / maxWidth) * 100 : 0}%`,
                  width: `${maxWidth > 0 ? ((currentPct - targetPct) / maxWidth) * 100 : 0}%`,
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Summary row — light gold background */}
      {!collapsed && (
        <div className="flex flex-wrap items-center gap-4 border-b border-white/5 bg-[#C9A84C]/5 px-4 py-2 text-[10px] text-gray-500">
          <span>
            Holdings:{" "}
            <span className="text-gray-300">{activeHoldings.length}</span>
          </span>
          <span>
            Wtd Expense:{" "}
            <span className="text-gray-300">{(weightedExpense * 100).toFixed(3)}%</span>
          </span>
          <span>
            Wtd Yield:{" "}
            <span className="text-emerald-400">{(weightedYield * 100).toFixed(2)}%</span>
          </span>
          <span>
            Total Parity Gap:{" "}
            <span className={totalParityGap < 0 ? "text-red-400" : "text-emerald-400"}>
              {totalParityGap >= 0 ? "+" : ""}$
              {Math.abs(totalParityGap).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </span>
          <span>
            Signals:{" "}
            <span className="text-emerald-400">{entryCount} entry</span> /&nbsp;
            <span className="text-gray-400">{holdCount} hold</span> /&nbsp;
            <span className="text-red-400">{exitCount} exit</span>
          </span>
        </div>
      )}

      {/* Holdings table */}
      {!collapsed && (
        <HoldingsTable
          holdings={sleeve.holdings}
          weightingMethod={sleeve.weightingMethod}
          totalNAV={totalPortfolioNAV}
        />
      )}
    </div>
  );
}
