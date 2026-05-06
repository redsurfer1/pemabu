"use client";

import { useEffect, useState } from "react";
import type { PortfolioKPIs } from "@/types/allocation";

interface PortfolioKPIBarProps {
  kpis: PortfolioKPIs;
}

function RelativeTime({ date }: { date: Date }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    function update() {
      const diff = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diff < 60) setLabel(`${diff}s ago`);
      else if (diff < 3600) setLabel(`${Math.floor(diff / 60)}m ago`);
      else setLabel(`${Math.floor(diff / 3600)}h ago`);
    }
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [date]);
  return (
    <span title={date.toLocaleString()} className="cursor-default">
      {label}
    </span>
  );
}

export function PortfolioKPIBar({ kpis }: PortfolioKPIBarProps) {
  const cappedBadge =
    kpis.cappedPositionCount > 0
      ? "rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-400"
      : "rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-400";

  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-[#0D1B2A]/80 p-4 sm:grid-cols-4 lg:grid-cols-8">
      {/* Total NAV */}
      <div className="col-span-2 sm:col-span-2">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Total NAV</p>
        <p className="text-2xl font-bold text-white font-[Georgia,serif]">
          $
          {kpis.totalNAV.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>

      {/* Active ETFs */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Active ETFs</p>
        <p className="text-xl font-medium text-white">{kpis.activeETFCount}</p>
      </div>

      {/* Wtd Expense */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Wtd Expense</p>
        <p className="text-xl font-medium text-white">
          {(kpis.weightedExpenseRatio * 100).toFixed(2)}%
        </p>
      </div>

      {/* Wtd Div Yield */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Wtd Div Yield</p>
        <p className="text-xl font-medium text-emerald-400">
          {(kpis.weightedDivYield * 100).toFixed(2)}%
        </p>
      </div>

      {/* Main Sleeve % */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Main Sleeve</p>
        <p className="text-xl font-medium text-white">
          {(kpis.mainSleevePct * 100).toFixed(0)}%
        </p>
      </div>

      {/* Income Sleeve % */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Income Sleeve</p>
        <p className="text-xl font-medium text-[#C9A84C]">
          {(kpis.incomeSleevePct * 100).toFixed(0)}%
        </p>
      </div>

      {/* Capped Positions */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Capped</p>
        <p className="mt-1">
          <span className={`text-sm font-medium ${cappedBadge}`}>
            {kpis.cappedPositionCount}
          </span>
        </p>
      </div>

      {/* Last Refreshed — spans remaining on mobile */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500">Last Refreshed</p>
        <p className="text-sm text-gray-300">
          {kpis.lastRefreshed ? (
            <RelativeTime date={kpis.lastRefreshed} />
          ) : (
            "Never"
          )}
        </p>
      </div>
    </div>
  );
}
