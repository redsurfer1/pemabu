// ── Enums ────────────────────────────────────────────────────────

export type HoldingStatus = "Active" | "Comparable";
export type SleevePurpose = "Appreciation" | "Income" | "Stability" | "Growth" | "Custom";
export type SleeveWeightingMethod = "COMPOSITE_SCORE" | "YIELD_PROPORTIONAL" | "MANUAL";
export type TrendSignal = "Consider Entry" | "Hold" | "Consider Exit";
export type VolCapFlag = "OK" | "CAPPED" | "N/A";

export type Theme =
  | "Tech"
  | "Intl"
  | "Crypto"
  | "Dividend"
  | "US-Value"
  | "US-Growth"
  | "US-LargeCap"
  | "US-Mid"
  | "US-Small"
  | "US-Broad"
  | "Global"
  | "Commodities"
  | "Infrastructure"
  | "Healthcare"
  | "ComSvc"
  | "Broad";

// ── Model assumptions ─────────────────────────────────────────────

export interface ModelAssumptionsView {
  retWeight3mo: number;   // 0.40
  retWeight6mo: number;   // 0.25
  retWeight1yr: number;   // 0.20
  retWeight3yr: number;   // 0.10
  retWeight5yr: number;   // 0.05
  scoreWeightExp: number; // 0.30
  scoreWeightRet: number; // 0.30
  scoreWeightDiv: number; // 0.15
  scoreWeightShp: number; // 0.25
  incomeBudgetPct: number;// 0.12
  volCapMultiplier: number;// 3.0
  themeCapPct: number;    // 0.10
}

// Legacy alias — kept so existing code importing ModelAssumptions still compiles
export type ModelAssumptions = ModelAssumptionsView & { id: string; portfolioId: string };

// Alias used by engine functions (no DB id fields)
export type EngineAssumptions = ModelAssumptionsView;

export const DEFAULT_ENGINE_ASSUMPTIONS: EngineAssumptions = {
  retWeight3mo: 0.40,
  retWeight6mo: 0.25,
  retWeight1yr: 0.20,
  retWeight3yr: 0.10,
  retWeight5yr: 0.05,
  scoreWeightExp: 0.30,
  scoreWeightRet: 0.30,
  scoreWeightDiv: 0.15,
  scoreWeightShp: 0.25,
  incomeBudgetPct: 0.12,
  volCapMultiplier: 3.0,
  themeCapPct: 0.10,
};

// ── Core computed holding (full output of engine) ─────────────────

export interface ComputedHolding {
  // Identity
  id: string;
  ticker: string;
  name: string;
  status: HoldingStatus;
  theme: Theme;
  // Position
  qty: number;
  price: number;
  value: number;
  expenseRatio: number;
  divDollar: number;
  divAPY: number;
  // Historical prices (spreadsheet cols AL-AP)
  price3mo: number;
  price6mo: number;
  price1yr: number;
  price3yr: number;
  price5yr: number;
  // Period returns (spreadsheet cols N-R)
  ret3mo: number;
  ret6mo: number;
  ret1yr: number;
  ret3yr: number;
  ret5yr: number;
  // Scoring inputs (spreadsheet cols S-U)
  blendedReturn: number;
  vol3mo: number;
  sharpeProxy: number;
  // PERCENTRANK scores 0-1 (spreadsheet cols V-Y)
  prExpense: number;
  prReturn: number;
  prDivAPY: number;
  prSharpe: number;
  // Composite scoring (spreadsheet cols Z-AF)
  compositeScore: number;
  scoreRank: number | null;
  rawScoreWt: number;
  equalWtBase: number;
  volCapFlag: VolCapFlag;
  themeExposurePct: number;
  themeCappedWt: number;
  // Allocation output (spreadsheet cols AG-AI)
  finalTargetWt: number;
  parityDollarAmt: number;
  parityDollarChg: number;
  // Weight tracking (spreadsheet cols K-M)
  currentWtPct: number;
  targetWtPct: number;   // alias for finalTargetWt — same value
  parityGapPct: number;  // currentWtPct - targetWtPct
  // Signal (spreadsheet col AJ)
  trendSignal: TrendSignal;
}

// ── Sleeve view ───────────────────────────────────────────────────

export interface SleeveView {
  id: string;
  name: string;
  purpose: SleevePurpose;
  budgetPct: number;
  weightingMethod: SleeveWeightingMethod;
  sortOrder: number;
  isActive: boolean;
  holdings: ComputedHolding[];
  // Sleeve-level aggregates
  subtotalValue: number;
  subtotalCurrentPct: number;
  subtotalTargetPct: number;
  totalParityGapDollars: number;
  weightedExpenseRatio: number;
  weightedDivYield: number;
  signalSummary: {
    considerEntry: number;
    hold: number;
    considerExit: number;
  };
}

// Legacy alias — components using the old shape still compile
export type SleeveData = SleeveView & {
  signalSummary: { entry: number; hold: number; exit: number };
};

// ── Portfolio KPI view (Dashboard sheet) ─────────────────────────

export interface PortfolioKPIs {
  totalNAV: number;
  activeETFCount: number;
  weightedExpenseRatio: number;
  weightedDivYield: number;
  mainSleevePct: number;
  incomeSleevePct: number;
  cappedPositionCount: number;
  lastRefreshed: Date | null;
}

// ── Full portfolio view ───────────────────────────────────────────

export interface PortfolioView {
  id: string;
  name: string;
  kpis: PortfolioKPIs;
  sleeves: SleeveView[];
  assumptions: ModelAssumptionsView;
}

// ── Engine input types ────────────────────────────────────────────

export interface HoldingInput {
  id: string;
  ticker: string;
  name: string;
  status: HoldingStatus;
  theme: string;
  qty: number;
  price: number;
  expenseRatio: number;
  divDollar: number;
  price3mo: number;
  price6mo: number;
  price1yr: number;
  price3yr: number;
  price5yr: number;
  manualTargetWt?: number;
}

/** Role row for unified allocation intake (multi-sleeve v3.2 orchestration). */
export type AllocationSleeveRole = "MAIN" | "INCOME" | "MANUAL";

export interface AllocationEngineHolding {
  id: string;
  ticker: string;
  name: string;
  status: HoldingStatus;
  theme: string;
  qty: number;
  price: number;
  expenseRatio: number;
  divDollar: number;
  sleeveRole: AllocationSleeveRole;
  manualPricing?: boolean;
  manualTargetWt?: number;
}

/** Income sleeve row input (yield-weighted sleeve). */
export interface IncomeHoldingInput {
  id: string;
  ticker: string;
  name: string;
  qty: number;
  price: number;
  divDollar: number;
  expenseRatio?: number;
}

export interface HistoricalPrices {
  [ticker: string]: {
    "3mo"?: number;
    "6mo"?: number;
    "1yr"?: number;
    "3yr"?: number;
    "5yr"?: number;
  };
}

export interface CurrentPrices {
  [ticker: string]: number;
}
