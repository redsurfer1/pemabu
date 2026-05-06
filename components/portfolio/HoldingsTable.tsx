"use client";

import { useState, useMemo } from "react";
import type { ComputedHolding, SleeveWeightingMethod } from "@/types/allocation";

interface HoldingsTableProps {
  holdings: ComputedHolding[];
  weightingMethod: SleeveWeightingMethod;
  totalNAV: number;
}

type SortKey = keyof ComputedHolding;

// ── Formatters ───────────────────────────────────────────────────────

function fmtDollar(v: number): string {
  if (v < 0)
    return `($${Math.abs(v).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })})`;
  return `+$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDollarPlain(v: number): string {
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function fmtScore(v: number): string {
  return v.toFixed(4);
}

// ── Signal pill ──────────────────────────────────────────────────────

function SignalPill({ signal }: { signal: string }) {
  if (signal === "Consider Entry")
    return (
      <span className="inline-block rounded-full bg-[#E8F5E9]/20 px-2 py-0.5 text-[10px] font-medium text-[#81C784]">
        {signal}
      </span>
    );
  if (signal === "Consider Exit")
    return (
      <span className="inline-block rounded-full bg-[#FFEBEE]/20 px-2 py-0.5 text-[10px] font-medium text-[#EF9A9A]">
        {signal}
      </span>
    );
  return (
    <span className="inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-gray-400">
      {signal}
    </span>
  );
}

// ── Vol cap badge ────────────────────────────────────────────────────

function VolCapBadge({ flag }: { flag: string }) {
  if (flag === "CAPPED")
    return (
      <span className="inline-block rounded-full bg-[#FFF8E1]/20 px-2 py-0.5 text-[10px] font-medium text-[#E65100]">
        CAPPED
      </span>
    );
  if (flag === "OK")
    return (
      <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
        OK
      </span>
    );
  return <span className="text-gray-500 text-[10px]">—</span>;
}

// ── Score mini-bar ───────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#C9A84C]"
          style={{ width: `${Math.min(score * 100, 100)}%` }}
        />
      </div>
      <span className="w-10 text-right text-[10px] text-gray-400">{fmtScore(score)}</span>
    </div>
  );
}

// ── Parity cell color ────────────────────────────────────────────────

function parityClass(chg: number): string {
  if (chg > 50) return "text-[#2E7D32] bg-[#E8F5E9]/10";
  if (chg < -50) return "text-[#C62828] bg-[#FFEBEE]/10";
  return "text-gray-300";
}

// ── Shared header/cell classes ────────────────────────────────────────

const thClass =
  "whitespace-nowrap px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-gray-500 cursor-pointer hover:text-gray-300 transition-colors select-none";
const tdClass = "whitespace-nowrap px-2 py-1.5 text-xs";

export function HoldingsTable({ holdings, weightingMethod, totalNAV: _totalNAV }: HoldingsTableProps) {
  const defaultSort: SortKey =
    weightingMethod === "YIELD_PROPORTIONAL" ? "divAPY" : "compositeScore";

  const [sortKey, setSortKey] = useState<SortKey>(defaultSort);
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const active = holdings.filter((h) => h.status === "Active");
    const comparable = holdings.filter((h) => h.status === "Comparable");

    active.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const aNum = typeof av === "number" ? av : 0;
      const bNum = typeof bv === "number" ? bv : 0;
      if (typeof av === "number" && typeof bv === "number")
        return sortAsc ? aNum - bNum : bNum - aNum;
      return String(av).localeCompare(String(bv)) * (sortAsc ? 1 : -1);
    });

    return [...active, ...comparable];
  }, [holdings, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  // ── MANUAL sleeve ─────────────────────────────────────────────────
  if (weightingMethod === "MANUAL") {
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
              <tr key={h.id} className="border-b border-white/5 hover:bg-white/5">
                <td className={`${tdClass} font-mono text-white`}>{h.ticker}</td>
                <td className={`${tdClass} text-gray-400`}>{h.name}</td>
                <td className={`${tdClass} text-right text-white`}>{fmtDollarPlain(h.value)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{fmtPct(h.expenseRatio)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{fmtPct(h.targetWtPct)}</td>
                <td className={`${tdClass} text-right ${parityClass(h.parityDollarChg)}`}>
                  {fmtDollar(h.parityDollarChg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── YIELD_PROPORTIONAL (income) sleeve ───────────────────────────
  if (weightingMethod === "YIELD_PROPORTIONAL") {
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
              <tr key={h.id} className="border-b border-white/5 hover:bg-white/5">
                <td className={`${tdClass} font-mono text-white`}>{h.ticker}</td>
                <td className={`${tdClass} text-gray-400`}>{h.name}</td>
                <td className={`${tdClass} text-right text-white`}>{h.qty.toLocaleString()}</td>
                <td className={`${tdClass} text-right text-white`}>{fmtDollarPlain(h.price)}</td>
                <td className={`${tdClass} text-right text-white`}>{fmtDollarPlain(h.value)}</td>
                <td className={`${tdClass} text-right text-emerald-400`}>{fmtPct(h.divAPY)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{fmtPct(h.currentWtPct)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{fmtPct(h.targetWtPct)}</td>
                <td className={`${tdClass} text-right ${parityClass(h.parityDollarChg)}`}>
                  {fmtDollar(h.parityDollarChg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── COMPOSITE_SCORE (main) sleeve — full table ────────────────────
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/10">
            <th className={`${thClass} sticky left-0 bg-[#0D1B2A] z-10`}>Status</th>
            <th
              className={`${thClass} sticky left-[44px] bg-[#0D1B2A] z-10`}
              onClick={() => handleSort("ticker")}
            >
              Ticker
            </th>
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
            <th className={`${thClass} text-right`} onClick={() => handleSort("rawScoreWt")}>Raw Wt%</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("themeCappedWt")}>Theme Capped</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("finalTargetWt")}>Final Target</th>
            <th className={thClass} onClick={() => handleSort("volCapFlag")}>Vol Cap</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("themeExposurePct")}>Theme Exp%</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("parityDollarAmt")}>Parity $ Amt</th>
            <th className={`${thClass} text-right`} onClick={() => handleSort("parityDollarChg")}>Parity $ Chg</th>
            <th className={thClass} onClick={() => handleSort("trendSignal")}>Signal</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            const isComp = h.status === "Comparable";
            const rowCls = isComp ? "opacity-50" : "";
            const themeExpColor =
              h.themeExposurePct > 0.10
                ? "text-[#EF9A9A]"
                : h.themeExposurePct > 0.08
                ? "text-amber-400"
                : "text-gray-300";
            const retColor = (v: number) =>
              v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-300";

            return (
              <tr
                key={h.id}
                className={`border-b border-white/5 hover:bg-white/5 ${rowCls}`}
              >
                <td className={`${tdClass} sticky left-0 bg-[#0D1B2A]`}>
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${isComp ? "bg-gray-500" : "bg-emerald-400"}`}
                  />
                </td>
                <td
                  className={`${tdClass} sticky left-[44px] bg-[#0D1B2A] font-mono ${isComp ? "italic text-gray-400" : "text-white"}`}
                >
                  {h.ticker}
                </td>
                <td className={`${tdClass} max-w-[120px] truncate text-gray-400`}>{h.name}</td>
                <td className={`${tdClass} text-gray-400`}>{h.theme}</td>
                <td className={`${tdClass} text-right text-white`}>{h.qty.toLocaleString()}</td>
                <td className={`${tdClass} text-right text-white`}>{fmtDollarPlain(h.price)}</td>
                <td className={`${tdClass} text-right text-white`}>{fmtDollarPlain(h.value)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{fmtPct(h.expenseRatio)}</td>
                <td className={`${tdClass} text-right text-emerald-400`}>{fmtPct(h.divAPY)}</td>
                <td className={`${tdClass} text-right text-gray-300`}>{fmtPct(h.currentWtPct)}</td>
                <td
                  className={`${tdClass} text-right ${
                    h.parityGapPct < -0.01
                      ? "text-red-400"
                      : h.parityGapPct > 0.01
                      ? "text-emerald-400"
                      : "text-gray-300"
                  }`}
                >
                  {isComp ? "—" : fmtPct(h.parityGapPct)}
                </td>
                <td className={`${tdClass} text-right text-gray-300`}>
                  {isComp ? "—" : fmtPct(h.targetWtPct)}
                </td>
                <td className={`${tdClass} text-right ${retColor(h.ret3mo)}`}>{fmtPct(h.ret3mo)}</td>
                <td className={`${tdClass} text-right ${retColor(h.ret6mo)}`}>{fmtPct(h.ret6mo)}</td>
                <td className={`${tdClass} text-right ${retColor(h.ret1yr)}`}>{fmtPct(h.ret1yr)}</td>
                <td className={`${tdClass} text-right font-medium text-white`}>{fmtPct(h.blendedReturn)}</td>
                <td className={tdClass}>
                  {isComp ? (
                    <span className="text-gray-600">—</span>
                  ) : (
                    <ScoreBar score={h.compositeScore} />
                  )}
                </td>
                <td className={`${tdClass} text-right font-medium text-white`}>
                  {h.scoreRank ?? "—"}
                </td>
                <td className={`${tdClass} text-right text-gray-300`}>
                  {isComp ? "—" : fmtPct(h.rawScoreWt)}
                </td>
                <td className={`${tdClass} text-right text-gray-300`}>
                  {isComp ? "—" : fmtPct(h.themeCappedWt)}
                </td>
                <td className={`${tdClass} text-right text-gray-300`}>
                  {isComp ? "—" : fmtPct(h.finalTargetWt)}
                </td>
                <td className={tdClass}>
                  <VolCapBadge flag={h.volCapFlag} />
                </td>
                <td className={`${tdClass} text-right ${themeExpColor}`}>
                  {fmtPct(h.themeExposurePct)}
                </td>
                <td className={`${tdClass} text-right text-gray-300`}>
                  {isComp ? "—" : fmtDollarPlain(h.parityDollarAmt)}
                </td>
                <td className={`${tdClass} text-right ${parityClass(h.parityDollarChg)}`}>
                  {isComp ? "—" : fmtDollar(h.parityDollarChg)}
                </td>
                <td className={tdClass}>
                  <SignalPill signal={h.trendSignal} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
