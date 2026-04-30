"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePortfolios } from "@/hooks/usePortfolios";
import {
  DEFAULT_ASSUMPTIONS,
  type Assumptions,
} from "@/lib/portfolio/formula-engine";
import { usePortfolioEngine } from "@/lib/portfolio/use-portfolio-engine";
import type { ComputedRow } from "@/lib/portfolio/use-portfolio-engine";

type TabKey = "dashboard" | "signals" | "assumptions" | "audit";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "signals", label: "Signals" },
  { key: "assumptions", label: "Assumptions" },
  { key: "audit", label: "Data Audit" },
];

const sortableColumns: Array<keyof ComputedRow> = [
  "rank_overall",
  "symbol",
  "price_current",
  "change_24h",
  "change_7d",
  "market_value",
  "current_weight",
  "target_sleeve_pct",
  "return_3mo",
  "return_6mo",
  "return_1yr",
  "return_3yr",
  "return_5yr",
  "return_weighted_avg",
  "volatility_3mo",
  "rsi_14",
  "composite_score",
  "parity_dollars",
  "parity_change_dollars",
  "shares_delta",
];

function num(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number(v).toFixed(d);
}

function pct(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Number(v * 100).toFixed(d)}%`;
}

export default function PortfolioEnginePage() {
  return (
    <Suspense fallback={<PortfolioEngineSkeleton />}>
      <PortfolioEnginePageContent />
    </Suspense>
  );
}

function PortfolioEnginePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [sort, setSort] = useState<{ key: keyof ComputedRow; asc: boolean }>({
    key: "rank_overall",
    asc: true,
  });
  const [newTicker, setNewTicker] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [localAssumptions, setLocalAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);

  const { data: portfolios = [] } = usePortfolios();
  const portfolioParam = searchParams.get("portfolio");
  const selected = portfolioParam && portfolios.some((p) => p.id === portfolioParam)
    ? portfolioParam
    : portfolios[0]?.id ?? "";

  useEffect(() => {
    if (!selected) return;
    if (portfolioParam === selected) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("portfolio", selected);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, portfolioParam, router, searchParams, selected]);

  const {
    computed,
    totalMV,
    loading,
    error,
    lastRefreshed,
    realtimeStatus,
    refreshSignals,
    addHolding,
    removeHolding,
    updateAssumptions,
  } = usePortfolioEngine(selected);

  const activeRows = useMemo(() => computed.filter((r) => r.rowStatus === "Active"), [computed]);
  const avgRsi = useMemo(() => {
    const vals = activeRows.map((r) => r.rsi_14).filter((v): v is number => v != null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }, [activeRows]);
  const avgWret = useMemo(() => {
    const vals = activeRows
      .map((r) => r.return_weighted_avg)
      .filter((v): v is number => v != null);
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }, [activeRows]);

  const sortedComputed = useMemo(() => {
    const rows = [...computed];
    rows.sort((a, b) => compareRows(a, b, sort.key, sort.asc));
    return rows;
  }, [computed, sort]);

  function handleSort(key: keyof ComputedRow) {
    setSort((prev) =>
      prev.key === key
        ? {
            key,
            asc: !prev.asc,
          }
        : {
            key,
            asc: true,
          },
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e8e6e0]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="text-center">
            <h2 className="font-['Space_Grotesk'] text-xl text-[#e8e6e0]">No portfolios found</h2>
            <p className="mt-2 font-['DM_Mono'] text-xs text-[#e8e6e0]">
              Create a portfolio first to use the engine.
            </p>
            <Link
              href="/portfolio/new"
              className="mt-4 inline-block rounded border border-[#00c896] px-4 py-2 text-xs text-[#00c896] hover:bg-[#00c89611]"
            >
              Create Portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#ddd]">
      <style>{`
        @keyframes loading-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .loading-dot {
          animation: loading-dot 1s ease-in-out infinite;
        }
      `}</style>
      <div className="border-b border-[#1a1a24] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded border border-[#333340] px-3 py-1 text-xs text-[#888] hover:border-[#00c896] hover:text-[#00c896] transition-colors"
            >
              &larr; Dashboard
            </Link>
            <div>
              <h1 className="font-['Space_Grotesk'] text-lg text-white">PEMABU /// Portfolio Engine</h1>
              <p className="font-['DM_Mono'] text-xs text-[#888]">
                Last refreshed: {lastRefreshed ?? "never"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selected}
              onChange={(e) => {
                const nextId = e.target.value;
                const params = new URLSearchParams(searchParams.toString());
                params.set("portfolio", nextId);
                router.push(`${pathname}?${params.toString()}`, { scroll: false });
              }}
              className="min-w-[180px] rounded border border-[#333340] bg-[#111118] px-2 py-1 text-xs text-white"
            >
              {portfolios.length === 0 ? (
                <option value="">No portfolios</option>
              ) : (
                portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => void refreshSignals()}
              disabled={!selected}
              className="rounded border border-[#00c89655] px-3 py-1 text-xs text-[#00c896] hover:bg-[#00c89611]"
            >
              {loading ? "Refreshing..." : "Refresh Prices"}
            </button>
            <span
              title={`Live updates: ${realtimeStatus}`}
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                realtimeStatus === "connected"
                  ? "bg-[#00c896]"
                  : realtimeStatus === "connecting"
                    ? "loading-dot bg-[#f59e0b]"
                    : "bg-[#ff6b6b]"
              }`}
              aria-hidden
            />
            <input
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              placeholder="Ticker"
              className="w-24 rounded border border-[#333340] bg-[#111118] px-2 py-1 text-xs"
            />
            <input
              type="number"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-16 rounded border border-[#333340] bg-[#111118] px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() =>
                void addHolding({
                  symbol: newTicker,
                  quantity: Number(newQty || 0),
                }).then(() => {
                  setNewTicker("");
                  setNewQty("1");
                })
              }
              disabled={!selected}
              className="rounded border border-[#00c89655] px-3 py-1 text-xs text-[#00c896] hover:bg-[#00c89611]"
            >
              + ADD
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded px-3 py-1 text-xs ${
                tab === t.key ? "bg-[#00c89622] text-[#00c896]" : "bg-[#111118] text-[#888]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {error ? <p className="mt-2 text-xs text-[#ff6b6b]">{error}</p> : null}
      </div>

      {tab === "dashboard" && (
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Kpi label="Total MV" value={`$${num(totalMV, 2)}`} />
            <Kpi label="Active Positions" value={String(activeRows.length)} />
            <Kpi label="Avg RSI" value={num(avgRsi, 2)} />
            <Kpi label="Avg Wtd Return" value={pct(avgWret, 2)} />
            <Kpi label="Entry Signals" value={String(activeRows.filter((r) => r.alert_primary === "Consider Entry").length)} />
            <Kpi label="Exit Signals" value={String(activeRows.filter((r) => r.alert_primary === "Consider Exit").length)} />
          </div>

          <div className="overflow-x-auto rounded border border-[#1a1a24]">
            <table className="w-full min-w-[1700px] font-['DM_Mono'] text-xs">
              <thead className="bg-[#111118] text-[#888]">
                <tr>
                  {(
                    [
                      { label: "Rank", key: "rank_overall" },
                      { label: "Status" },
                      { label: "Ticker", key: "symbol" },
                      { label: "Name" },
                      { label: "Price", key: "price_current" },
                      { label: "24h", key: "change_24h" },
                      { label: "7d", key: "change_7d" },
                      { label: "MV", key: "market_value" },
                      { label: "Wt%", key: "current_weight" },
                      { label: "Tgt%", key: "target_sleeve_pct" },
                      { label: "3mo", key: "return_3mo" },
                      { label: "6mo", key: "return_6mo" },
                      { label: "1yr", key: "return_1yr" },
                      { label: "3yr", key: "return_3yr" },
                      { label: "5yr", key: "return_5yr" },
                      { label: "WtdRet", key: "return_weighted_avg" },
                      { label: "Vol", key: "volatility_3mo" },
                      { label: "RSI", key: "rsi_14" },
                      { label: "Alert P" },
                      { label: "Alert S" },
                      { label: "Composite", key: "composite_score" },
                      { label: "Parity$", key: "parity_dollars" },
                      { label: "Δ$", key: "parity_change_dollars" },
                      { label: "ΔShares", key: "shares_delta" },
                      { label: "Delete" },
                    ] as Array<{ label: string; key?: keyof ComputedRow }>
                  ).map((h) => {
                    const isSortable = h.key != null && sortableColumns.includes(h.key);
                    const isActive = h.key != null && sort.key === h.key;
                    const suffix = isActive ? (sort.asc ? " ↑" : " ↓") : "";
                    return (
                      <th key={h.label} className="px-2 py-2 text-left">
                        {isSortable ? (
                          <button
                            type="button"
                            onClick={() => h.key && handleSort(h.key)}
                            className="text-left transition-colors hover:text-white"
                          >
                            {h.label}
                            {suffix}
                          </button>
                        ) : (
                          h.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedComputed.map((r) => (
                  <tr key={r.id} className={r.rowStatus === "Comparable" ? "opacity-60" : ""}>
                    <td className="px-2 py-1">{r.rank_overall ?? "—"}</td>
                    <td className="px-2 py-1">{r.rowStatus}</td>
                    <td className="px-2 py-1 text-white">{r.symbol}</td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1">{num(r.price_current)}</td>
                    <td className="px-2 py-1">{pct(r.change_24h)}</td>
                    <td className="px-2 py-1">{pct(r.change_7d)}</td>
                    <td className="px-2 py-1">{num(r.market_value)}</td>
                    <td className="px-2 py-1">{pct(r.current_weight)}</td>
                    <td className="px-2 py-1">{num(r.target_parity_weight)}</td>
                    <td className="px-2 py-1">{pct(r.return_3mo)}</td>
                    <td className="px-2 py-1">{pct(r.return_6mo)}</td>
                    <td className="px-2 py-1">{pct(r.return_1yr)}</td>
                    <td className="px-2 py-1">{pct(r.return_3yr)}</td>
                    <td className="px-2 py-1">{pct(r.return_5yr)}</td>
                    <td className="px-2 py-1">{pct(r.return_weighted_avg)}</td>
                    <td className="px-2 py-1">{num(r.volatility_abs, 4)}</td>
                    <td className="px-2 py-1">{num(r.rsi_14, 2)}</td>
                    <td className="px-2 py-1">{r.alert_primary ?? "—"}</td>
                    <td className="px-2 py-1">{r.alert_secondary ?? "—"}</td>
                    <td className="px-2 py-1">{num(r.composite_score, 3)}</td>
                    <td className="px-2 py-1">{num(r.parity_dollars)}</td>
                    <td className="px-2 py-1">{num(r.parity_change_dollars)}</td>
                    <td className="px-2 py-1">{num(r.shares_delta, 3)}</td>
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        className="text-[#888] hover:text-[#ff6b6b]"
                        onClick={() => void removeHolding(r.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "signals" && (
        <div className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2 xl:grid-cols-3">
          {activeRows.map((r) => (
            <div key={r.id} className="rounded border border-[#1a1a24] bg-[#111118] p-4 text-xs">
              <div className="mb-2 flex justify-between">
                <span className="text-white">{r.symbol}</span>
                <span>#{r.rank_overall ?? "—"}</span>
              </div>
              <p>Price: {num(r.price_current)}</p>
              <p>Alert P: {r.alert_primary ?? "—"}</p>
              <p>Alert S: {r.alert_secondary ?? "—"}</p>
              <p>WtdRet: {pct(r.return_weighted_avg)}</p>
              <p>RSI: {num(r.rsi_14)}</p>
              <p>Vol: {num(r.volatility_abs, 4)}</p>
              <p>Parity Δ: {num(r.parity_change_dollars)}</p>
              <p>Tgt%: {num(r.target_sleeve_pct, 4)}</p>
              <p>ΔShares: {num(r.shares_delta, 4)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "assumptions" && (
        <div className="space-y-4 p-6">
          <AssumptionEditor
            assumptions={localAssumptions}
            onChange={setLocalAssumptions}
            onSave={() => void updateAssumptions(localAssumptions)}
          />
        </div>
      )}

      {tab === "audit" && (
        <div className="overflow-x-auto p-6">
          <table className="w-full min-w-[1200px] border border-[#1a1a24] font-['DM_Mono'] text-xs">
            <thead className="bg-[#111118] text-[#888]">
              <tr>
                {[
                  "Ticker",
                  "name [C]",
                  "price1 [L]",
                  "price2 [M]",
                  "price3 [N]",
                  "basis3mo [Q]",
                  "basis6mo [R]",
                  "basis1yr [S]",
                  "basis3yr [T]",
                  "basis5yr [U]",
                  "Vol3mo",
                  "RSI [AN]",
                  "last_refresh",
                ].map((h) => (
                  <th key={h} className="px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {computed.map((r) => (
                <tr key={r.id}>
                  <td className="px-2 py-1">{r.symbol}</td>
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 py-1">{num(r.price_current)}</td>
                  <td className="px-2 py-1">{num(r.price_24h_basis)}</td>
                  <td className="px-2 py-1">{num(r.price_7d_basis)}</td>
                  <td className="px-2 py-1">{num(r.basis_price_3mo)}</td>
                  <td className="px-2 py-1">{num(r.basis_price_6mo)}</td>
                  <td className="px-2 py-1">{num(r.basis_price_1yr)}</td>
                  <td className="px-2 py-1">{num(r.basis_price_3yr)}</td>
                  <td className="px-2 py-1">{num(r.basis_price_5yr)}</td>
                  <td className="px-2 py-1">{num(r.volatility_3mo, 4)}</td>
                  <td className="px-2 py-1">{num(r.rsi_14, 2)}</td>
                  <td className="px-2 py-1">{r.last_market_refresh ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function compareRows(
  a: ComputedRow,
  b: ComputedRow,
  key: keyof ComputedRow,
  asc: boolean,
): number {
  const av = a[key];
  const bv = b[key];

  const aNull = av == null;
  const bNull = bv == null;
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  if (
    key === "alert_primary" ||
    key === "alert_secondary" ||
    key === "symbol" ||
    key === "name"
  ) {
    const result = String(av).localeCompare(String(bv));
    return asc ? result : -result;
  }

  const aNum = Number(av);
  const bNum = Number(bv);
  const result = aNum - bNum;
  return asc ? result : -result;
}

function PortfolioEngineSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#ddd]">
      <div className="border-b border-[#1a1a24] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-5 w-56 animate-pulse rounded bg-[#111118]" />
            <div className="h-3 w-40 animate-pulse rounded bg-[#111118]" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-44 animate-pulse rounded border border-[#1a1a24] bg-[#111118]" />
            <div className="h-7 w-28 animate-pulse rounded border border-[#1a1a24] bg-[#111118]" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-24 animate-pulse rounded bg-[#111118]" />
          ))}
        </div>
      </div>
      <div className="p-6">
        <div className="h-64 animate-pulse rounded border border-[#1a1a24] bg-[#111118]" />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#1a1a24] bg-[#111118] p-3">
      <p className="font-['DM_Mono'] text-[10px] uppercase tracking-wider text-[#888]">{label}</p>
      <p className="font-['Space_Grotesk'] text-sm text-white">{value}</p>
    </div>
  );
}

function AssumptionEditor({
  assumptions,
  onChange,
  onSave,
}: {
  assumptions: Assumptions;
  onChange: (a: Assumptions) => void;
  onSave: () => void;
}) {
  const liveSum =
    assumptions.return_weights.r3mo +
    assumptions.return_weights.r6mo +
    assumptions.return_weights.r1yr +
    assumptions.return_weights.r3yr +
    assumptions.return_weights.r5yr;
  const nearOne = Math.abs(liveSum - 1) <= 0.001;
  const inRange = liveSum > 0.9 && liveSum < 1.1;
  const isRed = !nearOne && !inRange;
  const sumColor = nearOne ? "#00c896" : isRed ? "#ff6b6b" : "#f59e0b";
  const sumLabel = nearOne
    ? "Sum: 100% ✓"
    : isRed
      ? `Sum: ${(liveSum * 100).toFixed(1)}% — invalid, must be between 90% and 110%`
      : `Sum: ${(liveSum * 100).toFixed(1)}% — will be normalised on save`;

  function setWeight(key: keyof Assumptions["return_weights"], value: number) {
    onChange({
      ...assumptions,
      return_weights: { ...assumptions.return_weights, [key]: value },
    });
  }

  function setFactor(key: keyof Assumptions["factor_weights"], value: number) {
    onChange({
      ...assumptions,
      factor_weights: { ...assumptions.factor_weights, [key]: value },
    });
  }

  return (
    <div className="space-y-4 rounded border border-[#1a1a24] bg-[#111118] p-4 text-xs">
      <p className="font-['Space_Grotesk'] text-sm text-white">Assumptions</p>
      <p style={{ color: sumColor }}>{sumLabel}</p>
      {(
        [
          ["r3mo", "3mo"],
          ["r6mo", "6mo"],
          ["r1yr", "1yr"],
          ["r3yr", "3yr"],
          ["r5yr", "5yr"],
        ] as const
      ).map(([k, label]) => (
        <div key={k} className="flex items-center gap-2">
          <label className="w-24">{label}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={assumptions.return_weights[k]}
            onChange={(e) => setWeight(k, Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-16 text-right">{(assumptions.return_weights[k] * 100).toFixed(0)}%</span>
        </div>
      ))}
      {(
        [
          ["expense", "Expense"],
          ["pctWeight", "PctWeight"],
          ["divApy", "DivAPY"],
          ["volatility", "Volatility"],
        ] as const
      ).map(([k, label]) => (
        <div key={k} className="flex items-center gap-2">
          <label className="w-24">{label}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={assumptions.factor_weights[k]}
            onChange={(e) => setFactor(k, Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-16 text-right">{(assumptions.factor_weights[k] * 100).toFixed(0)}%</span>
        </div>
      ))}
      <button
        type="button"
        onClick={onSave}
        disabled={isRed}
        className="rounded border border-[#00c89655] px-3 py-1 text-[#00c896] disabled:cursor-not-allowed disabled:opacity-50 hover:bg-[#00c89611]"
      >
        Save assumptions
      </button>
    </div>
  );
}
