"use client";

import { PERFORMANCE_HISTORY_NOTICE } from "@/lib/constants/performance-history";
import type { PerformanceHistoryTableProps } from "@/lib/types/sleeve-performance";

function formatDrift(pct: number | null): string {
  if (pct === null) return "—";
  return `${pct.toFixed(1)}%`;
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return score.toFixed(1);
}

function formatWeek(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function gradeColor(grade: string | null): string {
  if (!grade) return "text-gray-500";
  const colors: Record<string, string> = {
    A: "text-emerald-400 font-semibold",
    B: "text-sky-400 font-semibold",
    C: "text-amber-400",
    D: "text-orange-400",
    F: "text-red-400",
  };
  return colors[grade] ?? "text-gray-500";
}

function SignalBar({
  entry,
  hold,
  exit,
  total,
}: {
  entry: number;
  hold: number;
  exit: number;
  total: number;
}) {
  if (total === 0) return <span className="text-gray-500 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1 text-xs">
      {entry > 0 ? <span className="text-emerald-400">↑{entry}</span> : null}
      {hold > 0 ? <span className="text-gray-500">·{hold}</span> : null}
      {exit > 0 ? <span className="text-red-400">↓{exit}</span> : null}
    </div>
  );
}

export function PerformanceHistoryTable({
  history,
  previewOnly,
  onUpgradeClick,
}: PerformanceHistoryTableProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-950/30 px-3 py-2">
        <p className="text-xs text-amber-200/90">⚠️ {PERFORMANCE_HISTORY_NOTICE}</p>
      </div>

      {previewOnly ? (
        <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Showing last 4 weeks. Intelligence tier includes full history.
          </p>
          {onUpgradeClick ? (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="text-xs font-medium text-sky-300 underline-offset-2 hover:underline whitespace-nowrap"
            >
              Upgrade →
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">Week</th>
              <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">Avg Drift</th>
              <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">Max Drift</th>
              <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">Score</th>
              <th className="pb-2 pr-4 font-medium text-gray-500 text-xs">Grade</th>
              <th className="pb-2 font-medium text-gray-500 text-xs">Signals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {history.map((week) => (
              <tr key={week.recorded_week} className="hover:bg-white/5">
                <td className="py-1.5 pr-4 text-xs text-gray-500 whitespace-nowrap">
                  {formatWeek(week.recorded_week)}
                </td>
                <td className="py-1.5 pr-4 text-xs font-mono text-gray-200">
                  {formatDrift(week.avg_drift_pct)}
                </td>
                <td className="py-1.5 pr-4 text-xs font-mono text-gray-200">
                  {formatDrift(week.max_drift_pct)}
                </td>
                <td className="py-1.5 pr-4 text-xs font-mono text-gray-200">
                  {formatScore(week.avg_composite_score)}
                </td>
                <td className={`py-1.5 pr-4 text-xs ${gradeColor(week.grade)}`}>
                  {week.grade ?? "—"}
                </td>
                <td className="py-1.5">
                  <SignalBar
                    entry={week.entry_signal_count}
                    hold={week.hold_signal_count}
                    exit={week.exit_signal_count}
                    total={week.total_holdings_count}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">
          No performance history yet. Check back after the first weekly snapshot runs.
        </p>
      ) : null}
    </div>
  );
}
