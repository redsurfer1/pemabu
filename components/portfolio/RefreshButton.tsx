"use client";

import { useState, useCallback } from "react";

interface RefreshButtonProps {
  portfolioId: string;
  onRefreshed?: (totalNAV: number) => void;
}

interface RefreshError {
  ticker: string;
  message: string;
}

export function RefreshButton({ portfolioId, onRefreshed }: RefreshButtonProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [cooldownSecsLeft, setCooldownSecsLeft] = useState(0);
  const [errors, setErrors] = useState<RefreshError[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const handleRefresh = useCallback(async () => {
    if (refreshing || cooldown) return;
    setRefreshing(true);
    setErrors([]);

    try {
      const { refreshPortfolioPrices } = await import("@/lib/actions/portfolio/refreshPortfolioPrices");
      const result = await refreshPortfolioPrices(portfolioId);
      if (result.success) {
        setLastRefreshed(new Date());
        onRefreshed?.(result.totalNAV ?? 0);
        // Start 60-second cooldown
        setCooldown(true);
        setCooldownSecsLeft(60);
        const interval = setInterval(() => {
          setCooldownSecsLeft((s) => {
            if (s <= 1) { clearInterval(interval); setCooldown(false); return 0; }
            return s - 1;
          });
        }, 1000);
      } else {
        setErrors([{ ticker: "–", message: result.error ?? "Unknown error" }]);
      }
    } catch (e) {
      setErrors([{ ticker: "–", message: e instanceof Error ? e.message : String(e) }]);
    } finally {
      setRefreshing(false);
    }
  }, [portfolioId, refreshing, cooldown, onRefreshed]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {lastRefreshed && (
          <span className="text-[10px] text-gray-500">
            {lastRefreshed.toLocaleTimeString()}
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || cooldown}
          className="rounded bg-[#C9A84C] px-4 py-1.5 text-xs font-medium text-[#0D1B2A] transition-colors hover:bg-[#C9A84C]/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing
            ? "Refreshing..."
            : cooldown
            ? `Refresh Prices (${cooldownSecsLeft}s)`
            : "Refresh Prices"}
        </button>
      </div>

      {errors.length > 0 && (
        <div className="mt-1 rounded border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-400">
          {errors.map((e, i) => (
            <div key={i}>
              {e.ticker !== "–" ? `${e.ticker}: ` : ""}{e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
