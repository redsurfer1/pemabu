import Decimal from "decimal.js";

/** Ten portfolio factor keys used in composite ranking (weights sum to 1). */
export const FACTOR_WEIGHT_KEYS = [
  "expense",
  "pctWeight",
  "weightedReturn",
  "divApy",
  "volatility",
  "thirteenF",
  "macroIntelligence",
  "governanceLayer",
  "politicalTracker",
  "tokenQuality",
] as const;

export type FactorWeightKey = (typeof FACTOR_WEIGHT_KEYS)[number];

export type FactorWeights = Record<FactorWeightKey, number>;

export const FACTOR_LABELS: Record<FactorWeightKey, string> = {
  expense: "Expense Ratio",
  pctWeight: "Target Allocation %",
  weightedReturn: "Blended Return",
  divApy: "Dividend Yield / APY",
  volatility: "Volatility Matrix",
  thirteenF: "13F Institutional Flow",
  macroIntelligence: "Macro Regime Alignment",
  governanceLayer: "Governance Robustness",
  politicalTracker: "Political / Regulatory Risk",
  tokenQuality: "Token / Asset Quality",
};

/** Default weights — 10 factors, sum = 1 (Decimal-verified). */
export const DEFAULT_FACTOR_WEIGHTS: FactorWeights = {
  expense: 0.12,
  pctWeight: 0.1,
  weightedReturn: 0.1,
  divApy: 0.1,
  volatility: 0.13,
  thirteenF: 0.1,
  macroIntelligence: 0.1,
  governanceLayer: 0.1,
  politicalTracker: 0.075,
  tokenQuality: 0.075,
};

export type FactorSubRanks = Record<FactorWeightKey, number>;

export function sumFactorWeights(weights: FactorWeights): Decimal {
  return FACTOR_WEIGHT_KEYS.reduce((s, k) => s.plus(weights[k]), new Decimal(0));
}

export function normaliseFactorWeights(weights: FactorWeights): FactorWeights {
  const sum = sumFactorWeights(weights);
  if (sum.isZero()) return { ...DEFAULT_FACTOR_WEIGHTS };
  const out = {} as FactorWeights;
  for (const k of FACTOR_WEIGHT_KEYS) {
    out[k] = new Decimal(weights[k]).div(sum).toNumber();
  }
  return out;
}

export function factorWeightsFromDbRow(row: Record<string, unknown>): FactorWeights {
  const weightedReturn = Number(
    row.factor_weighted_return ?? row.factor_pct_weight ?? DEFAULT_FACTOR_WEIGHTS.weightedReturn,
  );
  return {
    expense: Number(row.factor_expense ?? DEFAULT_FACTOR_WEIGHTS.expense),
    pctWeight: Number(
      row.factor_target_allocation ?? row.factor_pct_weight ?? DEFAULT_FACTOR_WEIGHTS.pctWeight,
    ),
    weightedReturn,
    divApy: Number(row.factor_div_apy ?? DEFAULT_FACTOR_WEIGHTS.divApy),
    volatility: Number(row.factor_volatility ?? DEFAULT_FACTOR_WEIGHTS.volatility),
    thirteenF: Number(row.factor_thirteen_f ?? DEFAULT_FACTOR_WEIGHTS.thirteenF),
    macroIntelligence: Number(
      row.factor_macro_intelligence ?? DEFAULT_FACTOR_WEIGHTS.macroIntelligence,
    ),
    governanceLayer: Number(row.factor_governance_layer ?? DEFAULT_FACTOR_WEIGHTS.governanceLayer),
    politicalTracker: Number(row.factor_political_tracker ?? DEFAULT_FACTOR_WEIGHTS.politicalTracker),
    tokenQuality: Number(row.factor_token_quality ?? DEFAULT_FACTOR_WEIGHTS.tokenQuality),
  };
}

export function factorWeightsToDbPayload(weights: FactorWeights): Record<string, number> {
  return {
    factor_expense: weights.expense,
    factor_target_allocation: weights.pctWeight,
    factor_weighted_return: weights.weightedReturn,
    factor_pct_weight: weights.weightedReturn,
    factor_div_apy: weights.divApy,
    factor_volatility: weights.volatility,
    factor_thirteen_f: weights.thirteenF,
    factor_macro_intelligence: weights.macroIntelligence,
    factor_governance_layer: weights.governanceLayer,
    factor_political_tracker: weights.politicalTracker,
    factor_token_quality: weights.tokenQuality,
  };
}

/** Pre–10-factor migration columns only (Supabase / vault before 20260626 expand). */
export function factorWeightsToLegacyDbPayload(weights: FactorWeights): Record<string, number> {
  return {
    factor_expense: weights.expense,
    factor_pct_weight: weights.weightedReturn,
    factor_div_apy: weights.divApy,
    factor_volatility: weights.volatility,
  };
}

/** Marketplace-safe factor metadata (weights only — no NAV or dollar amounts). */
export type SleeveFactorMetadata = {
  factor_weights: FactorWeights;
  factor_schema_version: 1;
};
