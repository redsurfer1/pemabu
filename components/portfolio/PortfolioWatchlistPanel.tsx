"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";
import { FIAT_WATCH_TICKERS } from "@/lib/portfolio/fiat-watchlist";

interface WatchEntry {
  id: string;
  ticker: string;
  name: string | null;
  currency: string;
}

async function fetchWatchList(portfolioId: string): Promise<WatchEntry[]> {
  const res = await fetch(
    `/api/workbook/watchlist?portfolioId=${encodeURIComponent(portfolioId)}`,
    { credentials: "same-origin" },
  );
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Failed to load watchlist");
  }
  const data = (await res.json()) as { watchList: WatchEntry[] };
  return data.watchList ?? [];
}

interface PortfolioWatchlistPanelProps {
  portfolioId: string | null;
  onAdd: (ticker: string) => Promise<void>;
  onRemove: (ticker: string) => Promise<void>;
}

export function PortfolioWatchlistPanel({
  portfolioId,
  onAdd,
  onRemove,
}: PortfolioWatchlistPanelProps) {
  const queryClient = useQueryClient();
  const [addTicker, setAddTicker] = useState("");

  const { data: watchList = [], isLoading } = useQuery({
    queryKey: ["portfolio", "watchlist", portfolioId],
    queryFn: () => fetchWatchList(portfolioId!),
    enabled: Boolean(portfolioId),
    staleTime: STALE.HOLDINGS,
  });

  const addMutation = useMutation({
    mutationFn: async (ticker: string) => {
      await onAdd(ticker);
    },
    onSuccess: () => {
      setAddTicker("");
      void queryClient.invalidateQueries({ queryKey: ["portfolio", "watchlist", portfolioId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (ticker: string) => {
      await onRemove(ticker);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["portfolio", "watchlist", portfolioId] });
    },
  });

  if (!portfolioId) {
    return (
      <div className="rounded-xl border border-[#1a1a24] py-12 text-center">
        <p className="text-sm text-[#888]">Select a portfolio to manage its watchlist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-500">
          Add fiat / ticker to watch list (USD)
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Ticker (e.g. USD, EUR, AAPL)"
            value={addTicker}
            onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter" && addTicker.trim()) {
                addMutation.mutate(addTicker.trim());
              }
            }}
            className="flex-1 rounded border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-xs text-white placeholder-gray-600 outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (addTicker.trim()) addMutation.mutate(addTicker.trim());
            }}
            disabled={!addTicker.trim() || addMutation.isPending}
            className="rounded-lg bg-emerald-500 px-5 py-1.5 text-sm text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {addMutation.isPending ? "Adding..." : "Add"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {FIAT_WATCH_TICKERS.map((ticker) => (
            <button
              key={ticker}
              type="button"
              onClick={() => setAddTicker(ticker)}
              className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-gray-500 hover:border-white/20 hover:text-white"
            >
              {ticker}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-600">
          Watchlist items appear on the Dashboard tab with status Watch. Prices refresh in USD;
          they are excluded from active position counts and ranking.
        </p>
        {addMutation.isError ? (
          <p className="mt-2 text-xs text-[#ff6b6b]">
            {addMutation.error instanceof Error ? addMutation.error.message : "Add failed"}
          </p>
        ) : null}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading watch list...</div>
      ) : watchList.length === 0 ? (
        <div className="rounded-xl border border-white/10 py-12 text-center">
          <p className="text-sm text-gray-500">No tickers on your watch list yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-xs text-gray-500">
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Currency</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {watchList.map((w, i) => (
                <tr
                  key={w.id}
                  className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-white">{w.ticker}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{w.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{w.currency ?? "USD"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(w.ticker)}
                      disabled={removeMutation.isPending}
                      className="text-xs text-gray-600 hover:text-red-400 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
