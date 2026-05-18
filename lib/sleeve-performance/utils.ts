import type { SleevePerformanceSummary, SleevePerformanceWeek } from "@/lib/types/sleeve-performance";

/** Monday of the ISO week containing `date`, as YYYY-MM-DD (UTC calendar date). */
export function getISOWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Letter grade from composite score (0–100 scale, matches marketplace strategy_grade). */
export function computeLetterGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

export function getConsistency(
  history: ReadonlyArray<Pick<SleevePerformanceWeek, "avg_drift_pct">>,
): SleevePerformanceSummary["consistency"] {
  if (history.length < 4) return "new";
  const drifts = history.map((h) => h.avg_drift_pct ?? 0);
  const avg = drifts.reduce((s, d) => s + d, 0) / drifts.length;
  return avg < 5 ? "consistent" : "variable";
}

export function computePerformanceSummary(
  weeks: ReadonlyArray<
    Pick<
      SleevePerformanceWeek,
      | "avg_drift_pct"
      | "avg_composite_score"
      | "grade"
      | "entry_signal_count"
      | "exit_signal_count"
      | "total_holdings_count"
    >
  >,
): SleevePerformanceSummary {
  if (weeks.length === 0) {
    return {
      consistency: "new",
      avgDriftPct: null,
      avgCompositeScore: null,
      weeksTracked: 0,
      dominantGrade: null,
    };
  }

  const driftValues = weeks
    .map((w) => w.avg_drift_pct)
    .filter((d): d is number => d != null && Number.isFinite(d));

  const avgDrift =
    driftValues.length > 0 ? driftValues.reduce((s, d) => s + d, 0) / driftValues.length : null;

  const scoreValues = weeks
    .map((w) => w.avg_composite_score)
    .filter((s): s is number => s != null && Number.isFinite(s));

  const avgScore =
    scoreValues.length > 0 ? scoreValues.reduce((s, v) => s + v, 0) / scoreValues.length : null;

  return {
    consistency: getConsistency(weeks),
    avgDriftPct: avgDrift != null ? Number(avgDrift.toFixed(2)) : null,
    avgCompositeScore: avgScore != null ? Number(avgScore.toFixed(1)) : null,
    weeksTracked: weeks.length,
    dominantGrade: mostFrequent(weeks.map((w) => w.grade).filter((g): g is string => Boolean(g))),
  };
}

export function mostFrequent<T>(arr: readonly T[]): T | null {
  if (arr.length === 0) return null;
  const freq = new Map<T, number>();
  for (const item of arr) freq.set(item, (freq.get(item) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
