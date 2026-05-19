"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";
import { PerformanceSparkline } from "@/components/marketplace/PerformanceSparkline";
import { PerformanceHistoryTable } from "@/components/marketplace/PerformanceHistoryTable";
import { getConsistency } from "@/lib/sleeve-performance/utils";
import type { SleevePerformanceResponse } from "@/lib/types/sleeve-performance";

type StrategyPerformanceCellProps = {
  strategyId: string;
  strategyName: string;
  showPrivate: boolean;
};

export function StrategyPerformanceCell({
  strategyId,
  strategyName,
  showPrivate,
}: StrategyPerformanceCellProps) {
  const [open, setOpen] = useState(false);

  const perfQuery = useQuery({
    queryKey: ["marketplace", "performance", strategyId],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/performance/${strategyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Performance unavailable");
      return (await res.json()) as SleevePerformanceResponse;
    },
    enabled: showPrivate,
    staleTime: STALE.LEADERBOARD,
  });

  if (!showPrivate) return null;

  const history = perfQuery.data?.history ?? [];
  const consistency = perfQuery.data?.summary?.consistency ?? getConsistency(history);
  const weeksTracked = perfQuery.data?.summary?.weeksTracked ?? history.length;
  const avgDrift = perfQuery.data?.summary?.avgDriftPct;
  const dominantGrade = perfQuery.data?.summary?.dominantGrade;

  function gradeColor(grade: string | null): string {
    if (!grade) return "text-gray-500";
    const colors: Record<string, string> = {
      A: "text-emerald-400",
      B: "text-sky-400",
      C: "text-amber-400",
      D: "text-orange-400",
      F: "text-red-400",
    };
    return colors[grade] ?? "text-gray-500";
  }

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`perf-history-${strategyId}`}
          >
            <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-[#0d1524] p-5 shadow-xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 id={`perf-history-${strategyId}`} className="text-sm font-semibold text-white">
                    {strategyName} — weekly history
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    What this strategy did each week — not a forecast of future results.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border border-white/10 px-2 py-1 text-xs text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>
              {perfQuery.isLoading ? (
                <p className="text-xs text-gray-500">Loading history…</p>
              ) : perfQuery.isError ? (
                <p className="text-xs text-red-400">Could not load performance history.</p>
              ) : perfQuery.data ? (
                <PerformanceHistoryTable
                  history={perfQuery.data.history}
                  previewOnly={perfQuery.data.previewOnly}
                  onUpgradeClick={
                    perfQuery.data.upgradeRequired
                      ? () => {
                          window.location.href = "/upgrade?service=intelligence_annual";
                        }
                      : undefined
                  }
                />
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <PerformanceSparkline
            history={history}
            consistency={consistency}
            weeksTracked={weeksTracked}
          />
          {avgDrift != null ? (
            <span className="text-[11px] text-gray-500" title="Average weekly drift">
              ∅{avgDrift.toFixed(1)}%
            </span>
          ) : null}
          {dominantGrade ? (
            <span className={`text-[11px] font-semibold ${gradeColor(dominantGrade)}`} title="Most common grade">
              {dominantGrade}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-fit rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-400 hover:border-white/20 hover:text-gray-200"
        >
          Details →
        </button>
      </div>
      {modal}
    </>
  );
}
