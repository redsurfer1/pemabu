"use client";

import type { PortfolioSummary } from "@/lib/types/database";

interface PortfolioCardProps {
  summary: PortfolioSummary;
  isSelected: boolean;
  onClick: () => void;
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "#10b981",
  fixed_income: "#C9A84C",
  alternatives: "#3B82F6",
  cash: "#475569",
  other: "#6B7280",
};

export function PortfolioCard({ summary, isSelected, onClick }: PortfolioCardProps) {
  const { portfolio, total_value, allocation, top_signal, holdings_count } = summary;

  const hasAlert = top_signal?.severity === "critical" || top_signal?.severity === "warning";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        isSelected ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 bg-white/5 hover:bg-white/[0.07]"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="max-w-[180px] truncate text-sm font-medium text-white">{portfolio.name}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {holdings_count} holding{holdings_count !== 1 ? "s" : ""}
          </p>
        </div>
        {top_signal && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
              hasAlert ? "bg-amber-400/10 text-amber-400" : "bg-blue-400/10 text-blue-400"
            }`}
          >
            {top_signal.type}
          </span>
        )}
      </div>

      <div className="mb-3">
        <p className="text-xl font-semibold text-white">
          {portfolio.currency}{" "}
          {total_value.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </p>
      </div>

      {allocation.length > 0 && (
        <div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
            {allocation.map((a) => (
              <div
                key={a.asset_class}
                style={{
                  width: `${Math.max(a.actual_pct, 0)}%`,
                  backgroundColor: ASSET_CLASS_COLORS[a.asset_class] ?? "#6B7280",
                }}
                title={`${a.asset_class}: ${a.actual_pct}%`}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {allocation.map((a) => (
              <span key={a.asset_class} className="text-xs text-gray-500">
                <span style={{ color: ASSET_CLASS_COLORS[a.asset_class] }}>●</span>{" "}
                {a.asset_class.replace("_", " ")} {a.actual_pct.toFixed(1)}%
                {Math.abs(a.drift_pct) >= 5 && (
                  <span className="ml-1 text-amber-400">
                    {a.drift_pct > 0 ? "+" : ""}
                    {a.drift_pct.toFixed(1)}%
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}
