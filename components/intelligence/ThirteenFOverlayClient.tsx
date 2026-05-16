"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Filing {
  period: string | null;
  filer: string | null;
  filed: string | null;
}

async function fetch13F(ticker: string): Promise<{ ticker: string; filings: Filing[]; error?: string }> {
  const res = await fetch(`/api/intelligence/13f-overlay?ticker=${encodeURIComponent(ticker)}`);
  if (res.status === 403) throw new Error("Intelligence tier required");
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ticker: string; filings: Filing[]; error?: string }>;
}

export function ThirteenFOverlayClient({ initialTicker = "AAPL" }: { initialTicker?: string }) {
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

      {query.isLoading ? <p className="text-sm text-gray-500">Loading 13F filings…</p> : null}
      {query.error ? (
        <p className="text-sm text-red-400">{query.error instanceof Error ? query.error.message : "Request failed"}</p>
      ) : null}
      {query.data?.error ? <p className="text-sm text-amber-400/90">{query.data.error}</p> : null}

      {!query.isLoading && !query.error && filings.length === 0 ? (
        <p className="text-sm text-gray-500">No 13F-HR filings found for {ticker} in the recent window.</p>
      ) : null}

      {filings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Filer</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Filed</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f, i) => (
                <tr key={`${f.filer}-${f.filed}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-gray-200">{f.filer ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{f.period ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{f.filed ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
