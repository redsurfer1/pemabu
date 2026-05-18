"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface TTFCriteria {
  [key: string]: boolean | null;
}

interface TTFScore {
  ticker: string;
  composite_score: number;
  criteria: TTFCriteria;
  summary_flags: string[];
  sources: { coingecko_id: string | null; data_available: boolean };
  scored_at?: string;
}

const CRITERIA_LABELS: Record<string, string> = {
  c1_whitepaper_exists: "Whitepaper Exists",
  c2_open_source: "Open Source",
  c3_code_audited: "Code Audited",
  c4_bug_bounty_active: "Bug Bounty Active",
  c5_team_doxxed: "Team Disclosed",
  c6_founders_disclosed: "Founders Disclosed",
  c7_tokenomics_disclosed: "Tokenomics Disclosed",
  c8_vesting_schedule_disclosed: "Vesting Schedule Disclosed",
  c9_treasury_transparency: "Treasury Transparency",
  c10_governance_mechanism: "Governance Mechanism",
  c11_on_chain_governance: "On-Chain Governance",
  c12_liquidity_lock: "Liquidity Locked",
  c13_cex_listing: "CEX Listed",
  c14_trading_volume_consistent: "Consistent Volume",
  c15_oracle_usage_disclosed: "Oracle Disclosed",
  c16_bridge_dependencies_disclosed: "Bridge Deps Disclosed",
  c17_regulatory_compliance_stated: "Compliance Stated",
  c18_developer_activity: "Active Development",
};

const CATEGORY_KEYS: Record<string, string[]> = {
  Documentation: ["c1_whitepaper_exists", "c2_open_source"],
  Security: ["c3_code_audited", "c4_bug_bounty_active"],
  Team: ["c5_team_doxxed", "c6_founders_disclosed"],
  Tokenomics: ["c7_tokenomics_disclosed", "c8_vesting_schedule_disclosed", "c9_treasury_transparency"],
  Governance: ["c10_governance_mechanism", "c11_on_chain_governance"],
  "Market Integrity": ["c12_liquidity_lock", "c13_cex_listing", "c14_trading_volume_consistent"],
  Infrastructure: ["c15_oracle_usage_disclosed", "c16_bridge_dependencies_disclosed"],
  Compliance: ["c17_regulatory_compliance_stated", "c18_developer_activity"],
};

function CriteriaValue({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-gray-600 text-xs">N/A</span>;
  return value ? (
    <span className="text-emerald-400 text-sm">✓</span>
  ) : (
    <span className="text-red-400 text-sm">✗</span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className="text-center">
      <div className={`text-5xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-gray-500 mt-1">/ 100</div>
    </div>
  );
}

export function TokenQualityClient({ initialTickers }: { initialTickers: string[] }) {
  const [ticker, setTicker] = useState(initialTickers[0] ?? "");
  const [input, setInput] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const scoreQuery = useQuery({
    queryKey: ["ttf-score", ticker, refreshNonce],
    queryFn: async () => {
      const forceRefresh = refreshNonce > 0;
      const res = await fetch(
        `/api/token-quality/score?ticker=${encodeURIComponent(ticker)}${forceRefresh ? "&refresh=1" : ""}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ score: TTFScore; cached: boolean }>;
    },
    enabled: !!ticker,
    staleTime: 10 * 60 * 1000,
  });

  const data = scoreQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) { setTicker(input.trim()); setRefreshNonce(0); } }}
          placeholder="Enter ticker (e.g. ETH, BTC, SOL)"
          className="flex-1 px-4 py-2.5 bg-white/10 rounded-xl text-sm text-white border border-white/10 focus:outline-none focus:border-emerald-500 placeholder-gray-600"
        />
        <button
          onClick={() => { if (input.trim()) { setTicker(input.trim()); setRefreshNonce(0); } }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Score
        </button>
      </div>

      {initialTickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 self-center">Portfolio tokens:</span>
          {initialTickers.map((t) => (
            <button
              key={t}
              onClick={() => { setTicker(t); setInput(t); setRefreshNonce(0); }}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${ticker === t ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {scoreQuery.isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {scoreQuery.error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm">
          {scoreQuery.error instanceof Error ? scoreQuery.error.message : "Scoring failed"}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="bg-white/5 rounded-xl p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white font-mono">{data.score.ticker}</h2>
                  {data.cached && (
                    <button onClick={() => setRefreshNonce((n) => n + 1)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                      Refresh
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.score.summary_flags.map((f) => (
                    <span key={f} className={`px-2 py-0.5 rounded text-xs font-medium ${f.startsWith("⚠") ? "bg-red-900/40 text-red-300 border border-red-500/20" : "bg-emerald-900/40 text-emerald-300 border border-emerald-500/20"}`}>
                      {f}
                    </span>
                  ))}
                </div>
                {data.score.sources.coingecko_id && (
                  <p className="text-xs text-gray-600">CoinGecko ID: {data.score.sources.coingecko_id}</p>
                )}
              </div>
              <ScoreBadge score={data.score.composite_score} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(CATEGORY_KEYS).map(([cat, keys]) => (
              <div key={cat} className="bg-white/5 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{cat}</h3>
                {keys.map((k) => (
                  <div key={k} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                    <span className="text-sm text-gray-300">{CRITERIA_LABELS[k] ?? k}</span>
                    <CriteriaValue value={data.score.criteria[k] ?? null} />
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-600">
            Scores are derived from CoinGecko public data. Criteria marked N/A require manual verification (audit reports, governance docs).
            TTF scoring is advisory only — not financial advice.
          </p>
        </div>
      )}
    </div>
  );
}
