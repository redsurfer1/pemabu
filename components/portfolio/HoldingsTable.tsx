"use client";

import { useState, useMemo } from "react";
import type { ComputedHolding } from "@/types/allocation";

type SleeveType = "main" | "income" | "fidelity";
type SortKey = keyof ComputedHolding;

interface HoldingsTableProps {
  holdings: ComputedHolding[];
  sleeveType: SleeveType;
  totalNAV: number;
}

function formatDollar(v: number): string {
  if (v < 0) return `($${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function formatScore(v: number): string {
  return v.toFixed(4);
}

function signalPill(signal: string) {
  const base = "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium";
  if (signal === "Consider Entry") return <span className={`${base} bg-emerald-500/20 text-emerald-400`}>{signal}</span>;
  if (signal === "Consider Exit") return <span className={`${base} bg-red-500/20 text-red-400`}>{signal}</span>;
  return <span className={`${base} bg-gray-500/20 text-gray-400`}>{signal}</span>;
}

function volCapBadge(flag: string) {
  if (flag === "CAPPED") return <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">CAPPED</span>;
  if (flag === "OK") return <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">OK</span>;
  return <span className="text-gray-500 text-[10px]">—</span>;
}

function formatPriceAsOf(asOf: string | null | undefined): string {
  if (!asOf) return "Delayed";
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return "Delayed";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StalePriceIndicator({ isPriceStale, priceAsOf }: { isPriceStale?: boolean; priceAsOf?: string | null }) {
  if (!isPriceStale) return null;
  const label = priceAsOf ? `As of ${formatPriceAsOf(priceAsOf)}` : "Delayed quote";
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/80"
      title="Quote may be delayed or stale"
    >
      <svg
        className="h-3 w-3 shrink-0"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm.75 3.25a.75.75 0 0 0-1.5 0v4.19l-1.72 1.72a.75.75 0 1 0 1.06 1.06l2.25-2.25A.75.75 0 0 0 8.75 8.5V4.75Z" />
      </svg>
      {label}
    </span>
  );
}

function PriceCell({ price, isPriceStale, priceAsOf }: { price: number; isPriceStale?: boolean; priceAsOf?: string | null }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span>{formatDollar(price)}</span>
      <StalePriceIndicator isPriceStale={isPriceStale} priceAsOf={priceAsOf} />
    </div>
  );
}

export function HoldingsTable({ holdings, sleeveType, totalNAV: _totalNAV }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("compositeScore");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const active = holdings.filter((h) => h.status === "Active");
    const comparable = holdings.filter((h) => h.status === "Comparable");

    active.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return String(aVal).localeCompare(String(bVal)) * (sortAsc ? 1 : -1);
    });

    return [...active, ...comparable];
  }, [holdings, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const thClass = "whitespace-nowrap px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none";
  const tdClass = "whitespace-nowrap px-2 py-1.5 text-xs";

  if (sleeveType === "fidelity") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className={thClass} onClick={() => handleSort("ticker")}>Ticker</th>
              <th className={thClass} onClick={() => handleSort("name")}>Name</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("value")}>Value ($)</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("expenseRatio")}>Exp Ratio</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("targetWtPct")}>Target Wt%</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("parityDollarChg")}>Parity $ Chg</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.ticker} className="border-b border-white/5 hover:bg-white/5">
                <td className={`${tdClass} font-mono text-white`}>{h.ticker}</td>
                <td className={`${tdClass} text-gray-400`}>{h.name}</td>
                <td className={`${tdClass} text-right text-white`}>{formatDollar(h.value)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{formatPct(h.expenseRatio)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{formatPct(h.targetWtPct)}</td>
                <td className={`${tdClass} text-right ${h.parityDollarChg < -50 ? "text-red-400 bg-red-500/5" : h.parityDollarChg > 50 ? "text-emerald-400 bg-emerald-500/5" : "text-gray-300"}`}>
                  {formatDollar(h.parityDollarChg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (sleeveType === "income") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className={thClass} onClick={() => handleSort("ticker")}>Ticker</th>
              <th className={thClass} onClick={() => handleSort("name")}>Name</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("qty")}>Qty</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("price")}>Price</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("value")}>Value ($)</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("divAPY")}>Div APY</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("currentWtPct")}>Current Wt%</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("targetWtPct")}>Target Wt%</th>
              <th className={`${thClass} text-right`} onClick={() => handleSort("parityDollarChg")}>Parity $ Chg</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.ticker} className="border-b border-white/5 hover:bg-white/5">
                <td className={`${tdClass} font-mono text-white`}>{h.ticker}</td>
                <td className={`${tdClass} text-gray-400`}>{h.name}</td>
                <td className={`${tdClass} text-right text-white`}>{h.qty.toLocaleString()}</td>
                <td className={`${tdClass} text-right text-white`}>
                  <PriceCell price={h.price} isPriceStale={h.isPriceStale} priceAsOf={h.priceAsOf} />
                </td>
                <td className={`${tdClass} text-right text-white`}>{formatDollar(h.value)}</td>
                <td className={`${tdClass} text-right text-emerald-400`}>{formatPct(h.divAPY)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{formatPct(h.currentWtPct)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{formatPct(h.targetWtPct)}</td>
                <td className={`${tdClass} text-right ${h.parityDollarChg < -50 ? "text-red-400 bg-red-500/5" : h.parityDollarChg > 50 ? "text-emerald-400 bg-emerald-500/5" : "text-gray-300"}`}>
                  {formatDollar(h.parityDollarChg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Main sleeve — full table
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/10">
            <th className={`${thClass} sticky left-0 bg-[#0D1B2A] z-10`}>Status</th>
            <th className={`${thClass} sticky left-[52px] bg-[#0D1B2A] z-10`} onClick={() => handleSort("ticker")}>Ticker</th>
            <th className={thClass} onClick={() => handleSort("name")}>Name</th>
            <th className={thClass} onClick={() => handleSort("theme")}>Theme</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("qty")}>Qty</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("price")}>Price</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("value")}>Value ($)</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("expenseRatio")}>Exp Ratio</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("divAPY")}>Div APY</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("currentWtPct")}>Cur Wt%</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("parityGapPct")}>Gap%</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("targetWtPct")}>Target%</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("ret3mo")}>3mo</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("ret6mo")}>6mo</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("ret1yr")}>1yr</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("blendedReturn")}>Blend</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("compositeScore")}>Score</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("scoreRank")}>Rank</th>
            <th className={thClass}>Vol Cap</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("themeExposurePct")}>Theme%</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("parityDollarChg")}>Parity $</th>
            <th className={thClass}>Signal</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            const isComparable = h.status === "Comparable";
            const rowClass = isComparable ? "opacity-50 italic" : "";
            const themeExpColor = h.themeExposurePct > 0.10 ? "text-red-400" : h.themeExposurePct > 0.08 ? "text-amber-400" : "text-gray-300";

            return (
              <tr key={h.ticker} className={`border-b border-white/5 hover:bg-white/5 ${rowClass}`}>
                <td className={`${tdClass} sticky left-0 bg-[#0D1B2A]`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${isComparable ? "bg-gray-500" : "bg-emerald-400"}`} />
                </td>
                <td className={`${tdClass} sticky left-[52px] bg-[#0D1B2A] font-mono text-white`}>{h.ticker}</td>
                <td className={`${tdClass} text-gray-400 max-w-[120px] truncate`}>{h.name}</td>
                <td className={`${tdClass} text-gray-400`}>{h.theme}</td>
                <td className={`${tdClass} text-right text-white`}>{h.qty.toLocaleString()}</td>
                <td className={`${tdClass} text-right text-white`}>
                  <PriceCell price={h.price} isPriceStale={h.isPriceStale} priceAsOf={h.priceAsOf} />
                </td>
                <td className={`${tdClass} text-right text-white`}>{formatDollar(h.value)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{formatPct(h.expenseRatio)}</td>
                <td className={`${tdClass} text-right text-emerald-400`}>{formatPct(h.divAPY)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{formatPct(h.currentWtPct)}</td>
                <td className={`${tdClass} text-right ${h.parityGapPct < -0.05 ? "text-red-400" : h.parityGapPct > 0.05 ? "text-emerald-400" : "text-gray-300"}`}>
                  {formatPct(h.parityGapPct)}
                </td>
                <td className={`${tdClass} text-right text-gray-300`}>{formatPct(h.targetWtPct)}</td>
                <td className={`${tdClass} text-right ${h.ret3mo > 0 ? "text-emerald-400" : h.ret3mo < 0 ? "text-red-400" : "text-gray-300"}`}>
                  {formatPct(h.ret3mo)}
                </td>
                <td className={`${tdClass} text-right ${h.ret6mo > 0 ? "text-emerald-400" : h.ret6mo < 0 ? "text-red-400" : "text-gray-300"}`}>
                  {formatPct(h.ret6mo)}
                </td>
                <td className={`${tdClass} text-right ${h.ret1yr > 0 ? "text-emerald-400" : h.ret1yr < 0 ? "text-red-400" : "text-gray-300"}`}>
                  {formatPct(h.ret1yr)}
                </td>
                <td className={`${tdClass} text-right text-white font-medium`}>{formatPct(h.blendedReturn)}</td>
                <td className={`${tdClass} text-right`}>
                  <div className="flex items-center justify-end gap-1">
                    <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${Math.min(h.compositeScore * 100, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400 w-10 text-right">{formatScore(h.compositeScore)}</span>
                  </div>
                </td>
                <td className={`${tdClass} text-right text-white font-medium`}>{h.scoreRank ?? "—"}</td>
                <td className={tdClass}>{volCapBadge(h.volCapFlag)}</td>
                <td className={`${tdClass} text-right ${themeExpColor}`}>{formatPct(h.themeExposurePct)}</td>
                <td className={`${tdClass} text-right ${h.parityDollarChg < -50 ? "text-red-400 bg-red-500/5" : h.parityDollarChg > 50 ? "text-emerald-400 bg-emerald-500/5" : "text-gray-300"}`}>
                  {formatDollar(h.parityDollarChg)}
                </td>
                <td className={tdClass}>{signalPill(h.trendSignal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
