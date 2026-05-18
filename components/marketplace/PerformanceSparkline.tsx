"use client";

import type { PerformanceSparklineProps } from "@/lib/types/sleeve-performance";

const CONSISTENCY_COLORS = {
  consistent: {
    line: "#10B981",
    bg: "#10B98114",
    label: "Consistent",
  },
  variable: {
    line: "#F59E0B",
    bg: "#F59E0B14",
    label: "Variable",
  },
  new: {
    line: "#6B7280",
    bg: "#6B728014",
    label: "New",
  },
} as const;

export function PerformanceSparkline({
  history,
  consistency,
  weeksTracked,
  className = "",
}: PerformanceSparklineProps) {
  const colors = CONSISTENCY_COLORS[consistency];
  const WIDTH = 80;
  const HEIGHT = 24;
  const PADDING = 2;

  const driftValues = history
    .slice(0, 8)
    .reverse()
    .map((w) => w.avg_drift_pct ?? 0);

  const maxDrift = Math.max(...driftValues, 1);
  const minDrift = 0;

  const points = driftValues.map((drift, i) => {
    const x = PADDING + (i / Math.max(driftValues.length - 1, 1)) * (WIDTH - PADDING * 2);
    const normalizedDrift = (drift - minDrift) / (maxDrift - minDrift);
    const y = PADDING + normalizedDrift * (HEIGHT - PADDING * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = points.length > 1 ? `M ${points.join(" L ")}` : null;

  const ariaLabel =
    weeksTracked < 4
      ? "New strategy — performance history building"
      : `${colors.label} strategy — ${weeksTracked} weeks of historical data. Historical data only, not a prediction of future performance.`;

  if (weeksTracked === 0 || history.length === 0) {
    return (
      <div
        className={`flex items-center gap-1.5 ${className}`}
        aria-label="New strategy — no performance history yet"
      >
        <span className="text-xs text-gray-500">New</span>
        <div className="h-4 w-16 rounded bg-white/10" />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label={ariaLabel} title={ariaLabel}>
      <span className="text-xs font-medium" style={{ color: colors.line }}>
        {colors.label}
      </span>
      <svg width={WIDTH} height={HEIGHT} aria-hidden="true" className="overflow-visible">
        {pathD ? (
          <path
            d={`${pathD} L ${WIDTH - PADDING},${HEIGHT} L ${PADDING},${HEIGHT} Z`}
            fill={colors.bg}
            strokeWidth={0}
          />
        ) : null}
        {pathD ? (
          <path
            d={pathD}
            fill="none"
            stroke={colors.line}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
      <span className="text-xs text-gray-500 whitespace-nowrap">{weeksTracked}w</span>
    </div>
  );
}
