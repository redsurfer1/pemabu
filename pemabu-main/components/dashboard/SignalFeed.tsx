"use client";

import { useState } from "react";
import { usePortfolioSignals, useAcknowledgeSignal } from "@/hooks/usePortfolios";
import type { Signal, SignalType } from "@/lib/types/database";

const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  drift: "Drift",
  trend: "Trend",
  brief: "Brief",
  price_refresh_error: "Price error",
  assumption_drift: "Assumption",
};

const SEVERITY_COLORS = {
  info: "text-blue-400 bg-blue-400/10",
  warning: "text-amber-400 bg-amber-400/10",
  critical: "text-red-400 bg-red-400/10",
};

interface SignalFeedProps {
  portfolioId: string;
  limit?: number;
}

export function SignalFeed({ portfolioId, limit = 20 }: SignalFeedProps) {
  const [typeFilter, setTypeFilter] = useState<SignalType | "all">("all");

  const { data: signals = [], isLoading } = usePortfolioSignals(portfolioId, {
    type: typeFilter !== "all" ? typeFilter : undefined,
    limit,
  });

  const { mutate: ackSignal, isPending: isAcking } = useAcknowledgeSignal();

  const signalTypes: Array<SignalType | "all"> = ["all", "drift", "trend", "brief"];

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-400">Loading signals...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Filter:</span>
        {signalTypes.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTypeFilter(type)}
            className={`rounded px-2 py-0.5 text-xs capitalize transition-colors ${
              typeFilter === type ? "bg-emerald-500/20 text-emerald-400" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {type === "all" ? "All" : SIGNAL_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {signals.length === 0 ? (
        <p className="py-8 text-center text-xs text-gray-500">
          No signals
          {typeFilter !== "all" ? ` for ${SIGNAL_TYPE_LABELS[typeFilter]}` : ""}
        </p>
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAcknowledge={() =>
                ackSignal({
                  signalId: signal.id,
                  action: "acknowledge",
                })
              }
              onResolve={() =>
                ackSignal({
                  signalId: signal.id,
                  action: "resolve",
                })
              }
              isUpdating={isAcking}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalCard({
  signal,
  onAcknowledge,
  onResolve,
  isUpdating,
}: {
  signal: Signal;
  onAcknowledge: () => void;
  onResolve: () => void;
  isUpdating: boolean;
}) {
  const severityClass = SEVERITY_COLORS[signal.severity] ?? SEVERITY_COLORS.info;
  const typeLabel = SIGNAL_TYPE_LABELS[signal.type] ?? signal.type;
  const date = new Date(signal.created_at).toLocaleDateString();

  return (
    <div
      className={`rounded-lg border p-3 transition-opacity ${
        signal.status === "resolved" ? "border-white/5 opacity-40" : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${severityClass}`}>{typeLabel}</span>
            <span className="text-xs text-gray-500">{date}</span>
            {signal.status === "acknowledged" && <span className="text-xs text-gray-600">· seen</span>}
          </div>
          <p className="truncate text-sm font-medium text-white">{signal.title}</p>
          {signal.message && <p className="mt-0.5 text-xs text-gray-400">{signal.message}</p>}
        </div>
        {signal.status === "unacknowledged" && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={onAcknowledge}
              disabled={isUpdating}
              className="rounded border border-white/10 px-2 py-1 text-xs text-gray-500 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              Seen
            </button>
            <button
              type="button"
              onClick={onResolve}
              disabled={isUpdating}
              className="rounded border border-emerald-500/30 px-2 py-1 text-xs text-emerald-500 transition-colors hover:border-emerald-400/50 hover:text-emerald-400 disabled:opacity-50"
            >
              Resolve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
