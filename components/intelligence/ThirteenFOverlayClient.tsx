"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  PositionSentimentBadge,
  PositionSentimentSummary,
} from "@/components/intelligence/PositionSentimentBadge";
import type { ThirteenFSentiment } from "@/lib/intelligence/thirteen-f-edgar";
import type { PositionSentiment } from "@/lib/intelligence/position-sentiment";

interface Filing {
  period: string | null;
  filer: string | null;
  filed: string | null;
  cik: string | null;
  shares: number | null;
  priorShares: number | null;
  sentiment: ThirteenFSentiment;
}

function formatShares(shares: number | null): string {
  if (shares == null) return "—";
  return shares.toLocaleString();
}

async function fetch13F(ticker: string): Promise<{ ticker: string; filings: Filing[]; error?: string }> {
  const res = await fetch(`/api/intelligence/13f-overlay?ticker=${encodeURIComponent(ticker)}`);
  if (res.status === 403) throw new Error("Intelligence tier required");
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ticker: string; filings: Filing[]; error?: string }>;
}

export function ThirteenFOverlayClient({
  initialTicker = "AAPL",
  portfolioTickers = [],
}: {
  initialTicker?: string;
  portfolioTickers?: string[];
}) {
  const [input, setInput] = useState(initialTicker);
  const [ticker, setTicker] = useState(initialTicker);

  const query = useQuery({
    queryKey: ["13f-overlay", ticker],
    queryFn: () => fetch13F(ticker),
    enabled: ticker.length >= 1,
    staleTime: 10 * 60 * 1000,
  });

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = input.trim().toUpperCase();
    if (next) setTicker(next);
  }

  const filings = query.data?.filings ?? [];

  const latestByFiler = new Map<string, Filing>();
  for (const f of filings) {
    const key = f.cik ?? f.filer ?? "";
    if (!key) continue;
    const existing = latestByFiler.get(key);
    if (!existing || (f.period ?? "") > (existing.period ?? "")) {
      latestByFiler.set(key, f);
    }
  }
  const summary: Record<PositionSentiment, number> = {
    accumulating: 0,
    holding: 0,
    decreasing: 0,
    no_position: 0,
  };
  for (const f of latestByFiler.values()) {
    summary[f.sentiment]++;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Ticker</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          Search EDGAR
        </button>
      </form>

      {portfolioTickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 self-center">Portfolio:</span>
          {portfolioTickers.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setInput(t);
                setTicker(t);
              }}
              className={`rounded-lg px-3 py-1 font-mono text-xs transition-colors ${
                ticker === t
                  ? "bg-emerald-600 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {query.isLoading ? (
        <p className="text-sm text-gray-500">Loading 13F filings and position sentiment…</p>
      ) : null}
      {query.error ? (
        <p className="text-sm text-red-400">{query.error instanceof Error ? query.error.message : "Request failed"}</p>
      ) : null}
      {query.data?.error ? <p className="text-sm text-amber-400/90">{query.data.error}</p> : null}

      {!query.isLoading && !query.error && filings.length === 0 ? (
        <EmptyState title="No 13F filings" description="Search for a fund to see their latest filings" />
      ) : null}

      {latestByFiler.size > 0 ? (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(summary) as PositionSentiment[]).map((key) =>
            summary[key] > 0 ? (
              <span key={key} className="text-xs text-gray-500">
                <PositionSentimentBadge sentiment={key} />{" "}
                <span className="text-gray-400">{summary[key]} filer{summary[key] === 1 ? "" : "s"}</span>
              </span>
            ) : null,
          )}
        </div>
      ) : null}

      {filings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Filer</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Filed</th>
                <th className="px-4 py-3">Shares</th>
                <th className="px-4 py-3">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f, i) => (
                <tr key={`${f.cik}-${f.period}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-gray-200">{f.filer ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{f.period ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{f.filed ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-gray-300">
                    {formatShares(f.shares)}
                    {f.priorShares != null && f.priorShares > 0 ? (
                      <span className="ml-1 text-[10px] text-gray-600">
                        (was {formatShares(f.priorShares)})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <PositionSentimentBadge sentiment={f.sentiment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-white/10 px-4 py-2 text-[11px] text-gray-600">
            Sentiment compares share count vs the filer&apos;s prior reporting period (SEC 13F information table).
          </p>
        </div>
      ) : null}
    </div>
  );
}
