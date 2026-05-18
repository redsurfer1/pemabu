export interface SleevePerformanceWeek {
  recorded_week: string;
  avg_drift_pct: number | null;
  max_drift_pct: number | null;
  entry_signal_count: number;
  hold_signal_count: number;
  exit_signal_count: number;
  total_holdings_count: number;
  avg_composite_score: number | null;
  grade: string | null;
  was_published: boolean;
}

export interface SleevePerformanceSummary {
  consistency: "consistent" | "variable" | "new";
  avgDriftPct: number | null;
  avgCompositeScore: number | null;
  weeksTracked: number;
  dominantGrade: string | null;
}

export interface SleevePerformanceResponse {
  sleeveId: string;
  strategyName: string;
  tier: "full" | "preview";
  weeksAvailable: number;
  weeksShown: number;
  previewOnly: boolean;
  upgradeRequired: boolean;
  history: SleevePerformanceWeek[];
  summary: SleevePerformanceSummary;
  notice: string;
  dataAsOf: string | null;
}

export interface PerformanceSparklineProps {
  history: Pick<SleevePerformanceWeek, "recorded_week" | "avg_drift_pct" | "grade">[];
  consistency: SleevePerformanceSummary["consistency"];
  weeksTracked: number;
  className?: string;
}

export interface PerformanceHistoryTableProps {
  history: SleevePerformanceWeek[];
  previewOnly: boolean;
  onUpgradeClick?: () => void;
}
