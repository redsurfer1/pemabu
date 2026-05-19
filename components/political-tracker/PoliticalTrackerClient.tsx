"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  PositionSentimentBadge,
  PositionSentimentSummary,
} from "@/components/intelligence/PositionSentimentBadge";
import type { PositionSentiment } from "@/lib/intelligence/position-sentiment";
import type { EnrichedCongressionalDisclosure } from "@/lib/political-tracker/disclosure-sentiment";
import { DEMO_DISCLOSURES } from "@/lib/demo/demo-data";

async function fetchSignals(portfolioId: string): Promise<EnrichedCongressionalDisclosure[]> {
  const res = await fetch(`/api/political-tracker/signals?portfolio_id=${encodeURIComponent(portfolioId)}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { signals: EnrichedCongressionalDisclosure[] };
  return data.signals;
}

async function fetchRecent(ticker: string): Promise<EnrichedCongressionalDisclosure[]> {
  const params = ticker ? `?ticker=${encodeURIComponent(ticker)}&limit=50` : "?limit=50";
  const res = await fetch(`/api/political-tracker/recent${params}`);
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { disclosures: EnrichedCongressionalDisclosure[] };
  return data.disclosures;
}

const PARTY_COLOR: Record<string, string> = { D: "text-blue-400", R: "text-red-400" };

function formatExposure(value: number | null): string {
  if (value == null || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function DisclosureRow({ d }: { d: EnrichedCongressionalDisclosure }) {
  const partyColor = d.party ? (PARTY_COLOR[d.party] ?? "text-gray-400") : "text-gray-400";
  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-100">{d.representative}</td>
      <td className={`px-4 py-3 text-sm font-medium ${partyColor}`}>{d.party ?? "—"}</td>
      <td className="px-4 py-3 text-sm font-mono text-emerald-400">{d.ticker}</td>
      <td className="px-4 py-3 text-sm text-gray-300 capitalize">{d.transaction_type ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{d.amount_range ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-400">{d.transaction_date}</td>
      <td className="px-4 py-3 font-mono text-xs text-gray-400">
        {formatExposure(d.exposure)}
        {d.priorExposure != null && d.priorExposure > 0 ? (
          <span className="ml-1 text-[10px] text-gray-600">(was {formatExposure(d.priorExposure)})</span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <PositionSentimentBadge sentiment={d.sentiment} />
      </td>
    </tr>
  );
}

export function PoliticalTrackerClient({ portfolioId, demo = false }: { portfolioId: string; demo?: boolean }) {
  const [view, setView] = useState<"signals" | "recent">("signals");
  const [tickerFilter, setTickerFilter] = useState("");

  const signalsQuery = useQuery({
    queryKey: ["political-tracker-signals", portfolioId],
    queryFn: () => fetchSignals(portfolioId),
    staleTime: 5 * 60 * 1000,
    enabled: view === "signals" && !demo,
  });

  const recentQuery = useQuery({
    queryKey: ["political-tracker-recent", tickerFilter],
    queryFn: () => fetchRecent(tickerFilter),
    staleTime: 5 * 60 * 1000,
    enabled: view === "recent" && !demo,
  });

  const realRows = view === "signals" ? (signalsQuery.data ?? []) : (recentQuery.data ?? []);
  const rows = demo ? (DEMO_DISCLOSURES as unknown as EnrichedCongressionalDisclosure[]) : realRows;
  const isLoading = demo ? false : (view === "signals" ? signalsQuery.isLoading : recentQuery.isLoading);
  const error = demo ? null : (view === "signals" ? signalsQuery.error : recentQuery.error);

  const sentimentCounts = useMemo(() => {
    const counts: Record<PositionSentiment, number> = {
      accumulating: 0,
      holding: 0,
      decreasing: 0,
      no_position: 0,
    };
    for (const row of rows) {
      counts[row.sentiment]++;
    }
    return counts;
  }, [rows]);

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
        <p className="text-sm text-gray-500 text-center py-12">Loading disclosures and position sentiment…</p>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
          {error instanceof Error ? error.message : "Failed to load disclosures"}
        </div>
      )}

      {!isLoading && !error && rows.length === 0 && (
        <EmptyState
          title="No disclosures found"
          description={view === "signals"
            ? "No congressional trades found for your current holdings in the last 90 days."
            : "Congressional trading disclosures will appear here"}
        />
      )}

      {rows.length > 0 ? <PositionSentimentSummary counts={sentimentCounts} /> : null}

      {!isLoading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="bg-white/5">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Representative</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Party</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ticker</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Est. exposure</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <DisclosureRow key={d.id} d={d} />
              ))}
            </tbody>
          </table>
          <p className="border-t border-white/10 px-4 py-2 text-[11px] text-gray-600">
            Sentiment compares estimated net exposure after this trade vs the same representative&apos;s prior
            position in that ticker (from disclosure amount ranges).
          </p>
        </div>
      )}

      <p className="text-xs text-gray-600">
        Data sourced from House Stock Watcher (housestockwatcher.com). Updated daily. Senate disclosures not yet included.
      </p>
    </div>
  );
}
