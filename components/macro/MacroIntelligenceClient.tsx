"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";

type MacroRegime = "risk_on" | "risk_off" | "stagflation" | "deflation";

interface RegimeClassification {
  regime: MacroRegime;
  confidencePct: number;
  indicators: {
    vix: number;
    yield10y: number;
    yield2y: number;
    dxy: number;
    goldPct30d: number;
    btcPct30d: number;
    sp500Pct30d: number;
  };
  suggestedWeights: {
    hist3mo: number;
    hist6mo: number;
    hist1yr: number;
    hist3yr: number;
    hist5yr: number;
  };
  rationale: string;
}

interface RegimeHistoryRow {
  id: string;
  regime: MacroRegime;
  confidence_pct: number;
  classified_at: string;
  suggested_weights: Record<string, number> | null;
}

interface CorrelationRow {
  asset_pair: string;
  correlation_30d: number | null;
  correlation_90d: number | null;
  computed_at: string;
}

const REGIME_CONFIG: Record<
  MacroRegime,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  risk_on: {
    label: "Risk-On",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    description: "Growth positive. Equity momentum favoured. Recent history weighted.",
  },
  risk_off: {
    label: "Risk-Off",
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
    description: "Fear elevated. Safe-haven assets bid. Long-term mean reversion weighted.",
  },
  stagflation: {
    label: "Stagflation",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    description: "Inflation running hot, growth decelerating. Medium-term anchor weighted.",
  },
  deflation: {
    label: "Deflation / Contraction",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    description: "Yield curve inverted. Contraction risk elevated. Long-term recovery weighted.",
  },
};

const WEIGHT_LABELS: Record<string, string> = {
  hist3mo: "3-Month",
  hist6mo: "6-Month",
  hist1yr: "1-Year",
  hist3yr: "3-Year",
  hist5yr: "5-Year",
};

function correlationColor(r: number | null): string {
  if (r === null) return "bg-gray-800 text-gray-600";
  const abs = Math.abs(r);
  if (abs >= 0.7) return r > 0 ? "bg-emerald-900/60 text-emerald-300" : "bg-red-900/60 text-red-300";
  if (abs >= 0.4) return r > 0 ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400";
  return "bg-white/5 text-gray-400";
}

async function classifyRegime(
  indicators: RegimeClassification["indicators"],
): Promise<RegimeClassification> {
  const res = await fetch("/api/macro/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(indicators),
  });
  if (!res.ok) throw new Error("Classification failed");
  const data = (await res.json()) as { classification: RegimeClassification };
  return data.classification;
}

async function fetchHistory(): Promise<RegimeHistoryRow[]> {
  const res = await fetch("/api/macro/history", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch history");
  const data = (await res.json()) as { history: RegimeHistoryRow[] };
  return data.history;
}

async function fetchCorrelations(): Promise<CorrelationRow[]> {
  const res = await fetch("/api/macro/correlation", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch correlations");
  const data = (await res.json()) as { correlations: CorrelationRow[] };
  return data.correlations;
}

type IndicatorForm = {
  vix: string;
  yield10y: string;
  yield2y: string;
  dxy: string;
  goldPct30d: string;
  btcPct30d: string;
  sp500Pct30d: string;
};

const INDICATOR_FIELDS: Array<{
  key: keyof IndicatorForm;
  label: string;
  hint: string;
}> = [
  { key: "vix", label: "VIX", hint: "e.g. 18.5" },
  { key: "yield10y", label: "10Y Yield (%)", hint: "e.g. 4.35" },
  { key: "yield2y", label: "2Y Yield (%)", hint: "e.g. 4.80" },
  { key: "dxy", label: "DXY (Dollar Index)", hint: "e.g. 104.2" },
  { key: "goldPct30d", label: "Gold 30d Return (%)", hint: "e.g. 3.2" },
  { key: "btcPct30d", label: "BTC 30d Return (%)", hint: "e.g. -12.5" },
  { key: "sp500Pct30d", label: "S&P 500 30d Return (%)", hint: "e.g. 1.8" },
];

export function MacroIntelligenceClient() {
  const qc = useQueryClient();
  const [indicators, setIndicators] = useState<IndicatorForm>({
    vix: "",
    yield10y: "",
    yield2y: "",
    dxy: "",
    goldPct30d: "",
    btcPct30d: "",
    sp500Pct30d: "",
  });
  const [activeTab, setActiveTab] = useState<"classify" | "history" | "correlation">("classify");
  const [lastResult, setLastResult] = useState<RegimeClassification | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["macro", "history"],
    queryFn: fetchHistory,
    staleTime: STALE.MACRO,
  });

  const { data: correlations = [] } = useQuery({
    queryKey: ["macro", "correlation"],
    queryFn: fetchCorrelations,
    staleTime: STALE.MACRO_CORRELATION,
  });

  const { mutate: classify, isPending: isClassifying } = useMutation({
    mutationFn: classifyRegime,
    onSuccess: (result) => {
      setLastResult(result);
      void qc.invalidateQueries({ queryKey: ["macro", "history"] });
      void qc.invalidateQueries({ queryKey: ["macro", "correlation"] });
    },
  });

  function handleClassify() {
    const parsed = {
      vix: Number.parseFloat(indicators.vix),
      yield10y: Number.parseFloat(indicators.yield10y),
      yield2y: Number.parseFloat(indicators.yield2y),
      dxy: Number.parseFloat(indicators.dxy),
      goldPct30d: Number.parseFloat(indicators.goldPct30d),
      btcPct30d: Number.parseFloat(indicators.btcPct30d),
      sp500Pct30d: Number.parseFloat(indicators.sp500Pct30d),
    };
    if (Object.values(parsed).some((v) => !Number.isFinite(v))) return;
    classify(parsed);
  }

  const TABS = [
    { key: "classify" as const, label: "Classify" },
    { key: "history" as const, label: "Regime History" },
    { key: "correlation" as const, label: "Correlation Heatmap" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-white">Macro Intelligence</h1>
        <p className="mt-1 text-xs text-gray-500">
          Classify the current macro regime and receive regime-adjusted assumption weight suggestions for your
          portfolio engine.
        </p>
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-gray-500 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "classify" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-gray-500">
              Current Market Indicators
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {INDICATOR_FIELDS.map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-gray-500">{label}</label>
                  <input
                    type="number"
                    step="any"
                    placeholder={hint}
                    value={indicators[key]}
                    onChange={(e) => setIndicators((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleClassify}
              disabled={isClassifying}
              className="mt-4 rounded-lg bg-emerald-500 px-6 py-2 text-sm text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {isClassifying ? "Classifying..." : "Classify Regime"}
            </button>
          </div>

          {lastResult &&
            (() => {
              const cfg = REGIME_CONFIG[lastResult.regime];
              return (
                <div className={`rounded-xl border p-6 ${cfg.border} ${cfg.bg}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Current Regime</p>
                      <p className={`mt-1 text-2xl font-medium ${cfg.color}`}>{cfg.label}</p>
                      <p className="mt-1 text-xs text-gray-400">{cfg.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Confidence</p>
                      <p className={`text-2xl font-medium tabular-nums ${cfg.color}`}>
                        {lastResult.confidencePct}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    <p className="text-xs leading-relaxed text-gray-300">{lastResult.rationale}</p>
                  </div>

                  <div className="mt-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-500">
                      Regime-Adjusted Assumption Weights (Suggested)
                    </p>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.entries(lastResult.suggestedWeights).map(([key, val]) => (
                        <div key={key} className="rounded border border-white/10 bg-white/5 p-3 text-center">
                          <p className="text-[10px] text-gray-500">{WEIGHT_LABELS[key] ?? key}</p>
                          <p className={`mt-1 text-lg font-medium tabular-nums ${cfg.color}`}>{val}%</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-gray-600">
                      These are suggestions only. Use the Engine Assumptions tab to apply. Not a registered
                      investment advisor — for informational purposes only.
                    </p>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">No regime classifications yet.</p>
              <p className="mt-1 text-xs text-gray-600">Run a classification to begin building your regime history.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Regime</th>
                    <th className="px-4 py-3 text-right">Confidence</th>
                    <th className="px-4 py-3 text-right">3mo</th>
                    <th className="px-4 py-3 text-right">6mo</th>
                    <th className="px-4 py-3 text-right">1yr</th>
                    <th className="px-4 py-3 text-right">3yr</th>
                    <th className="px-4 py-3 text-right">5yr</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => {
                    const cfg = REGIME_CONFIG[row.regime];
                    const w = (row.suggested_weights ?? {}) as Record<string, number>;
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                      >
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {new Date(row.classified_at).toLocaleDateString()}
                        </td>
                        <td className={`px-4 py-3 text-xs font-medium ${cfg.color}`}>{cfg.label}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-gray-300">
                          {row.confidence_pct}%
                        </td>
                        {["hist3mo", "hist6mo", "hist1yr", "hist3yr", "hist5yr"].map((k) => (
                          <td key={k} className="px-4 py-3 text-right text-xs tabular-nums text-gray-400">
                            {w[k] != null ? `${w[k]}%` : "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "correlation" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            30-day and 90-day Pearson correlations between major asset class proxies (refreshed when you run a
            regime classification). Green = positive, red = negative; intensity = magnitude.
          </p>
          {correlations.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">No correlation data yet.</p>
              <p className="mt-1 text-xs text-gray-600">Run a regime classification to refresh the correlation cache.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left">Asset Pair</th>
                    <th className="px-4 py-3 text-center">30-Day r</th>
                    <th className="px-4 py-3 text-center">90-Day r</th>
                    <th className="px-4 py-3 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {correlations.map((row, i) => (
                    <tr
                      key={row.asset_pair}
                      className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-white">{row.asset_pair}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium tabular-nums ${correlationColor(
                            row.correlation_30d,
                          )}`}
                        >
                          {row.correlation_30d != null ? row.correlation_30d.toFixed(3) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium tabular-nums ${correlationColor(
                            row.correlation_90d,
                          )}`}
                        >
                          {row.correlation_90d != null ? row.correlation_90d.toFixed(3) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {new Date(row.computed_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-gray-600">
        Not a registered investment advisor. Macro regime classifications are rule-based algorithmic outputs for
        informational purposes only.
      </p>
    </div>
  );
}
