"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Disclosure {
  id: string;
  representative: string;
  party: string | null;
  state: string | null;
  ticker: string;
  asset_description: string | null;
  transaction_type: string | null;
  amount_range: string | null;
  transaction_date: string;
  filed_at_date: string | null;
}

async function fetchSignals(portfolioId: string): Promise<Disclosure[]> {
  const res = await fetch(`/api/political-tracker/signals?portfolio_id=${encodeURIComponent(portfolioId)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { signals: Disclosure[] };
  return data.signals;
}

async function fetchRecent(ticker: string): Promise<Disclosure[]> {
  const params = ticker ? `?ticker=${encodeURIComponent(ticker)}&limit=50` : "?limit=50";
  const res = await fetch(`/api/political-tracker/recent${params}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { disclosures: Disclosure[] };
  return data.disclosures;
}

const PARTY_COLOR: Record<string, string> = { D: "text-blue-400", R: "text-red-400" };

function DisclosureRow({ d }: { d: Disclosure }) {
  const partyColor = d.party ? (PARTY_COLOR[d.party] ?? "text-gray-400") : "text-gray-400";
  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-100">{d.representative}</td>
      <td className={`px-4 py-3 text-sm font-medium ${partyColor}`}>{d.party ?? "—"}</td>
      <td className="px-4 py-3 text-sm font-mono text-emerald-400">{d.ticker}</td>
      <td className="px-4 py-3 text-sm text-gray-300 capitalize">{d.transaction_type ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{d.amount_range ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{d.transaction_date}</td>
    </tr>
  );
}

export function PoliticalTrackerClient({ portfolioId }: { portfolioId: string }) {
  const [view, setView] = useState<"signals" | "recent">("signals");
  const [tickerFilter, setTickerFilter] = useState("");

  const signalsQuery = useQuery({
    queryKey: ["political-tracker-signals", portfolioId],
    queryFn: () => fetchSignals(portfolioId),
    staleTime: 5 * 60 * 1000,
    enabled: view === "signals",
  });

  const recentQuery = useQuery({
    queryKey: ["political-tracker-recent", tickerFilter],
    queryFn: () => fetchRecent(tickerFilter),
    staleTime: 5 * 60 * 1000,
    enabled: view === "recent",
  });

  const rows = view === "signals" ? (signalsQuery.data ?? []) : (recentQuery.data ?? []);
  const isLoading = view === "signals" ? signalsQuery.isLoading : recentQuery.isLoading;
  const error = view === "signals" ? signalsQuery.error : recentQuery.error;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setView("signals")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "signals"
                ? "bg-emerald-600 text-white"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            Portfolio Overlap
          </button>
          <button
            onClick={() => setView("recent")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "recent"
                ? "bg-emerald-600 text-white"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            All Recent
          </button>
        </div>

        {view === "recent" && (
          <input
            type="text"
            placeholder="Filter by ticker (e.g. NVDA)"
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value.toUpperCase())}
            className="px-3 py-2 bg-white/10 rounded-lg text-sm text-white placeholder-gray-500 border border-white/10 focus:outline-none focus:border-emerald-500 w-52"
          />
        )}
      </div>

      {view === "signals" && (
        <p className="text-sm text-gray-400">
          Congressional disclosures filed in the last 90 days matching your portfolio holdings.
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
          {error instanceof Error ? error.message : "Failed to load disclosures"}
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {view === "signals"
            ? "No congressional trades found for your current holdings in the last 90 days."
            : "No disclosures found."}
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full">
            <thead>
              <tr className="bg-white/5">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Representative</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Party</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ticker</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <DisclosureRow key={d.id} d={d} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-600">
        Data sourced from House Stock Watcher (housestockwatcher.com). Updated daily. Senate disclosures not yet included.
      </p>
    </div>
  );
}
