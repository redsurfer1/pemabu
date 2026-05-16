"use client";

import { useState } from "react";
import type { EngineAssumptions } from "@/types/allocation";

interface AssumptionsPanelProps {
  assumptions: EngineAssumptions;
  onSave: (updated: EngineAssumptions) => void;
  isRecomputing?: boolean;
  /** Income-sleeve assumptions. When provided, a second tab is shown. */
  incomeAssumptions?: EngineAssumptions;
  /** Called when income-sleeve assumptions are saved. Required if incomeAssumptions is provided. */
  onSaveIncome?: (updated: EngineAssumptions) => void;
}

type SleeveTab = "main" | "income";

function SleeveForm({
  local,
  setLocal,
  isRecomputing,
  onSave,
}: {
  local: EngineAssumptions;
  setLocal: (v: EngineAssumptions) => void;
  isRecomputing?: boolean;
  onSave: () => void;
}) {
  const retSum = local.retWeight3mo + local.retWeight6mo + local.retWeight1yr + local.retWeight3yr + local.retWeight5yr;
  const scoreSum = local.scoreWeightExp + local.scoreWeightRet + local.scoreWeightDiv + local.scoreWeightShp;
  const retValid = Math.abs(retSum - 1) < 0.001;
  const scoreValid = Math.abs(scoreSum - 1) < 0.001;

  const inputClass = "w-16 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white outline-none text-right focus:border-[#C9A84C]/50";
  const labelClass = "text-xs text-gray-400 w-32";

  return (
    <>
      {/* Return Period Weights */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-gray-500">
          Return Period Weights
        </p>
        <p className={`mb-2 text-[10px] ${retValid ? "text-emerald-400" : "text-red-400"}`}>
          Sum: {(retSum * 100).toFixed(1)}% {retValid ? "✓" : "- must equal 100%"}
        </p>
        <div className="space-y-2">
          {([
            ["retWeight3mo", "3 Month", local.retWeight3mo],
            ["retWeight6mo", "6 Month", local.retWeight6mo],
            ["retWeight1yr", "1 Year", local.retWeight1yr],
            ["retWeight3yr", "3 Year", local.retWeight3yr],
            ["retWeight5yr", "5 Year", local.retWeight5yr],
          ] as const).map(([key, label, val]) => (
            <div key={key} className="flex items-center justify-between">
              <span className={labelClass}>{label}</span>
              <input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => setLocal({ ...local, [key]: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Composite Scoring Weights */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-gray-500">
          Composite Scoring Weights
        </p>
        <p className={`mb-2 text-[10px] ${scoreValid ? "text-emerald-400" : "text-red-400"}`}>
          Sum: {(scoreSum * 100).toFixed(1)}% {scoreValid ? "✓" : "- must equal 100%"}
        </p>
        <div className="space-y-2">
          {([
            ["scoreWeightExp", "Expense Ratio", local.scoreWeightExp],
            ["scoreWeightRet", "Blended Return", local.scoreWeightRet],
            ["scoreWeightDiv", "Dividend APY", local.scoreWeightDiv],
            ["scoreWeightShp", "Sharpe Proxy", local.scoreWeightShp],
          ] as const).map(([key, label, val]) => (
            <div key={key} className="flex items-center justify-between">
              <span className={labelClass}>{label}</span>
              <input
                type="number"
                step="0.01"
                value={val}
                onChange={(e) => setLocal({ ...local, [key]: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Allocation Controls */}
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-gray-500">
          Allocation Controls
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Income Budget %</span>
            <input
              type="number"
              step="0.01"
              value={local.incomeBudgetPct}
              onChange={(e) => setLocal({ ...local, incomeBudgetPct: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={labelClass}>Vol Cap Multiplier</span>
            <input
              type="number"
              step="0.1"
              value={local.volCapMultiplier}
              onChange={(e) => setLocal({ ...local, volCapMultiplier: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className={labelClass}>Theme Cap %</span>
            <input
              type="number"
              step="0.01"
              value={local.themeCapPct}
              onChange={(e) => setLocal({ ...local, themeCapPct: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!retValid || !scoreValid || isRecomputing}
        className="w-full rounded bg-[#C9A84C] px-4 py-2 text-xs font-medium text-[#0D1B2A] transition-colors hover:bg-[#C9A84C]/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRecomputing ? "Recomputing..." : "Save & Recompute"}
      </button>
    </>
  );
}

export function AssumptionsPanel({
  assumptions,
  onSave,
  isRecomputing,
  incomeAssumptions,
  onSaveIncome,
}: AssumptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SleeveTab>("main");
  const [localMain, setLocalMain] = useState<EngineAssumptions>(assumptions);
  const [localIncome, setLocalIncome] = useState<EngineAssumptions>(
    incomeAssumptions ?? assumptions,
  );

  const hasIncome = incomeAssumptions != null && onSaveIncome != null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
      >
        Assumptions
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 overflow-y-auto border-l border-white/10 bg-[#0D1B2A] p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-[Georgia,serif] text-sm text-white">Scoring Assumptions</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-white text-xs"
        >
          Close
        </button>
      </div>

      {isRecomputing && (
        <div className="mb-3 rounded bg-[#C9A84C]/10 px-3 py-2 text-xs text-[#C9A84C]">
          Recomputing scores...
        </div>
      )}

      {/* Sleeve tabs — only shown when income sleeve is available */}
      {hasIncome && (
        <div className="mb-5 flex rounded border border-white/10 overflow-hidden">
          {(["main", "income"] as SleeveTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 text-[10px] font-medium uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? "bg-[#C9A84C]/20 text-[#C9A84C]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "main" ? "Main Sleeve" : "Income Sleeve"}
            </button>
          ))}
        </div>
      )}

      {activeTab === "main" || !hasIncome ? (
        <SleeveForm
          local={localMain}
          setLocal={setLocalMain}
          isRecomputing={isRecomputing}
          onSave={() => onSave(localMain)}
        />
      ) : (
        <SleeveForm
          local={localIncome}
          setLocal={setLocalIncome}
          isRecomputing={isRecomputing}
          onSave={() => onSaveIncome!(localIncome)}
        />
      )}
    </div>
  );
}
