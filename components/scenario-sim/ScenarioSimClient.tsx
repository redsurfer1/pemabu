"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface UsageData {
  tier: string;
  cap: number | null;
  current: number;
  remaining: number | null;
  month_key?: string;
}

interface SimResult {
  label: string;
  baseline: Record<string, number>;
  adjustments: Record<string, number>;
  projected_allocation: Record<string, number>;
  projected_drift_reduction_pct: number;
  run_at: string;
}

interface RunResponse {
  ok?: boolean;
  simulation?: SimResult;
  remaining?: number | null;
  error?: string;
  code?: string;
  overage_checkout_url?: string;
}

const ASSET_CLASSES = ["equity", "fixed_income", "alternatives", "cash", "crypto"] as const;

async function fetchUsage(): Promise<UsageData> {
  const res = await fetch("/api/scenario-sim/usage");
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UsageData>;
}

async function runSim(payload: {
  portfolio_id: string;
  adjustments: Record<string, number>;
  label: string;
}): Promise<RunResponse> {
  const res = await fetch("/api/scenario-sim/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json() as RunResponse;
  // 402: overage checkout prompt (pass through)
  // 501: FEATURE_COMING_SOON (pass through so onSuccess can display the gate message)
  if (!res.ok && res.status !== 402 && res.status !== 501) throw new Error(data.error ?? "Simulation failed");
  return data;
}

export function ScenarioSimClient({ portfolioId }: { portfolioId: string }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState("Scenario 1");
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [lastResult, setLastResult] = useState<SimResult | null>(null);
  const [overageUrl, setOverageUrl] = useState<string | null>(null);
  const [comingSoon, setComingSoon] = useState(false);

  const usageQuery = useQuery({ queryKey: ["sim-usage"], queryFn: fetchUsage, staleTime: 30_000 });

  const runMutation = useMutation({
    mutationFn: runSim,
    onSuccess: (data) => {
      if (data.ok && data.simulation) {
        setLastResult(data.simulation);
        setOverageUrl(null);
        setComingSoon(false);
        void qc.invalidateQueries({ queryKey: ["sim-usage"] });
      } else if (data.code === "SOFT_CAP_EXCEEDED") {
        setOverageUrl(data.overage_checkout_url ?? null);
        setComingSoon(false);
      } else if (data.code === "FEATURE_COMING_SOON") {
        setComingSoon(true);
        setOverageUrl(null);
      }
    },
  });

  const usage = usageQuery.data;
  const isAtCap =
    usage && usage.cap !== null && usage.remaining !== null && usage.remaining <= 0;

  function handleRun() {
    setOverageUrl(null);
    setComingSoon(false);
    runMutation.mutate({ portfolio_id: portfolioId, adjustments, label });
  }

  function setAdjustment(ac: string, val: number) {
    setAdjustments((prev) => ({ ...prev, [ac]: val }));
  }

  return (
    <div className="space-y-6">
      {usage && (
        <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Monthly Usage</p>
            <p className="text-lg font-semibold text-white">
              {usage.current}
              {usage.cap !== null ? ` / ${usage.cap}` : " (unlimited)"}
            </p>
          </div>
          {usage.cap !== null && (
            <div className="flex-1 min-w-[120px]">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isAtCap ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, (usage.current / usage.cap) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {usage.remaining !== null && (
            <p className="text-sm text-gray-400">{usage.remaining} remaining</p>
          )}
        </div>
      )}

      <div className="bg-white/5 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-medium text-gray-300">Scenario Parameters</h3>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 bg-white/10 rounded-lg text-sm text-white border border-white/10 focus:outline-none focus:border-emerald-500"
            placeholder="Scenario name"
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs text-gray-400">Adjust target allocation deltas (positive = increase, negative = decrease):</p>
          {ASSET_CLASSES.map((ac) => (
            <div key={ac} className="flex items-center gap-3">
              <label className="text-sm text-gray-300 w-28 capitalize">{ac.replace("_", " ")}</label>
              <input
                type="number"
                step="1"
                min="-50"
                max="50"
                value={adjustments[ac] ?? 0}
                onChange={(e) => setAdjustment(ac, Number(e.target.value))}
                className="w-24 px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white border border-white/10 focus:outline-none focus:border-emerald-500 text-center"
              />
              <span className="text-xs text-gray-500">pp</span>
            </div>
          ))}
        </div>

        {overageUrl && (
          <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-4 space-y-3">
            <p className="text-sm text-amber-300">Monthly cap reached. Run this simulation for $0.50?</p>
            <a
              href={overageUrl}
              className="inline-block px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Pay $0.50 &amp; Run
            </a>
          </div>
        )}

        {comingSoon && (
          <div className="bg-sky-900/30 border border-sky-500/30 rounded-lg p-4 space-y-1">
            <p className="text-sm font-medium text-sky-300">Simulation engine coming soon</p>
            <p className="text-xs text-sky-400/80">
              The full allocation simulation engine is under active development. Gating, usage
              tracking, and overage billing are wired and ready — the engine itself will project
              rebalancing outcomes against your live holdings. Your usage counter was not incremented.
            </p>
          </div>
        )}

        {runMutation.error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
            {runMutation.error.message}
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={runMutation.isPending}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {runMutation.isPending ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : null}
          Run Simulation
        </button>
      </div>

      {lastResult && (
        <div className="bg-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">{lastResult.label} — Results</h3>
            <span className="text-xs text-gray-500">{new Date(lastResult.run_at).toLocaleTimeString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Baseline</p>
              {Object.entries(lastResult.baseline).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-gray-400 capitalize">{k.replace("_", " ")}</span>
                  <span className="text-gray-200">{v}%</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">Projected</p>
              {Object.entries(lastResult.projected_allocation).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-gray-400 capitalize">{k.replace("_", " ")}</span>
                  <span className="text-emerald-300 font-medium">{v}%</span>
                </div>
              ))}
            </div>
          </div>

          {lastResult.projected_drift_reduction_pct > 0 && (
            <p className="text-sm text-emerald-400">
              Estimated drift reduction: {lastResult.projected_drift_reduction_pct}pp
            </p>
          )}
        </div>
      )}
    </div>
  );
}
