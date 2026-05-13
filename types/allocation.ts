export type SleeveType = "main" | "income" | "fidelity" | "custom";
export type SleevePurpose = "Appreciation" | "Income" | "Stability" | "Growth" | "Custom";
export type SleeveWeightingMethod = "COMPOSITE_SCORE" | "YIELD_PROPORTIONAL" | "MANUAL";
export type HoldingStatus = "Active" | "Comparable";
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

export interface ModelAssumptions {
  id: string;
  portfolioId: string;
  retWeight3mo: number;
  retWeight6mo: number;
  retWeight1yr: number;
  retWeight3yr: number;
  retWeight5yr: number;
  scoreWeightExp: number;
  scoreWeightRet: number;
  scoreWeightDiv: number;
  scoreWeightShp: number;
  incomeBudgetPct: number;
  volCapMultiplier: number;
  themeCapPct: number;
}

export interface ComputedHolding {
  id?: string;
  ticker: string;
  name: string;
  status: HoldingStatus;
  theme: Theme;
  qty: number;
  price: number;
  value: number;
  expenseRatio: number;
  divDollar: number;
  divAPY: number;
  currentWtPct: number;
  targetWtPct: number;
  parityGapPct: number;
  parityDollarChg: number;
  ret3mo: number;
  ret6mo: number;
  ret1yr: number;
  ret3yr: number;
  ret5yr: number;
  blendedReturn: number;
  vol3mo: number;
  sharpeProxy: number;
  prExpense: number;
  prReturn: number;
  prDivAPY: number;
  prSharpe: number;
  compositeScore: number;
  scoreRank: number | null;
  rawScoreWt: number;
  equalWtBase: number;
  volCapFlag: VolCapFlag;
  themeExposurePct: number;
  themeCappedWt?: number;
  finalTargetWt?: number;
  parityDollarAmt?: number;
  price3mo?: number;
  price6mo?: number;
  price1yr?: number;
  price3yr?: number;
  price5yr?: number;
  trendSignal: TrendSignal;
}

export interface SleeveData {
  id: string;
  name: string;
  purpose: SleevePurpose;
  budgetPct: number;
  sortOrder: number;
  isActive: boolean;
  holdings: ComputedHolding[];
  subtotalValue: number;
  subtotalCurrentPct: number;
  subtotalTargetPct: number;
  totalParityGap: number;
  weightedExpense: number;
  weightedDivYield: number;
  signalSummary: { entry: number; hold: number; exit: number };
}

export interface PortfolioView {
  id: string;
  name: string;
  totalNAV: number;
  activeETFCount: number;
  weightedExpense: number;
  weightedDivYield: number;
  cappedPositionCount: number;
  lastRefreshed: Date | null;
  sleeves: SleeveData[];
  assumptions: ModelAssumptions;
}

/** KPI strip for portfolio dashboard (aligned with PortfolioKPIBar). */
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

export interface HoldingInput {
  id?: string;
  name?: string;
  ticker: string;
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

export interface CurrentPrices {
  [ticker: string]: number;
}

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

export interface IncomeHoldingInput {
  id?: string;
  ticker: string;
  name: string;
  qty: number;
  price: number;
  divDollar: number;
  expenseRatio?: number;
}

export interface EngineAssumptions {
  retWeight3mo: number;
  retWeight6mo: number;
  retWeight1yr: number;
  retWeight3yr: number;
  retWeight5yr: number;
  scoreWeightExp: number;
  scoreWeightRet: number;
  scoreWeightDiv: number;
  scoreWeightShp: number;
  incomeBudgetPct: number;
  volCapMultiplier: number;
  themeCapPct: number;
}

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

export interface HistoricalPrices {
  [ticker: string]: {
    "3mo"?: number;
    "6mo"?: number;
    "1yr"?: number;
    "3yr"?: number;
    "5yr"?: number;
  };
}
