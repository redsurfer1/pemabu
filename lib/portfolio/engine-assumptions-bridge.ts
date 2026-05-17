import {
  DEFAULT_FACTOR_WEIGHTS,
  factorWeightsFromDbRow,
  factorWeightsToDbPayload,
  normaliseFactorWeights,
  type FactorWeights,
} from "@/lib/portfolio/portfolio-factors";
import type { EngineAssumptions } from "@/types/allocation";
import type { SleeveType } from "@/lib/types/database";

/** Map legacy model_assumptions score columns to 10-factor weights when new columns are absent. */
export function factorWeightsFromModelRow(row: Record<string, unknown>): FactorWeights {
  if (
    row.factor_expense != null ||
    row.factor_thirteen_f != null ||
    row.factor_target_allocation != null
  ) {
    return factorWeightsFromDbRow(row);
  }

  const legacy: FactorWeights = {
    expense: Number(row.score_weight_exp ?? DEFAULT_FACTOR_WEIGHTS.expense),
    pctWeight: Number(row.score_weight_pct ?? DEFAULT_FACTOR_WEIGHTS.pctWeight),
    weightedReturn: Number(row.score_weight_ret ?? DEFAULT_FACTOR_WEIGHTS.weightedReturn),
    divApy: Number(row.score_weight_div ?? DEFAULT_FACTOR_WEIGHTS.divApy),
    volatility: Number(row.score_weight_shp ?? DEFAULT_FACTOR_WEIGHTS.volatility),
    thirteenF: Number(row.score_weight_13f ?? DEFAULT_FACTOR_WEIGHTS.thirteenF),
    macroIntelligence: Number(
      row.score_weight_macro ?? DEFAULT_FACTOR_WEIGHTS.macroIntelligence,
    ),
    governanceLayer: Number(row.score_weight_gov ?? DEFAULT_FACTOR_WEIGHTS.governanceLayer),
    politicalTracker: Number(row.score_weight_political ?? DEFAULT_FACTOR_WEIGHTS.politicalTracker),
    tokenQuality: Number(row.score_weight_token ?? DEFAULT_FACTOR_WEIGHTS.tokenQuality),
  };
  return normaliseFactorWeights(legacy);
}

export function engineAssumptionsFromModelRow(row: Record<string, unknown>): EngineAssumptions {
  return {
    retWeight3mo: Number(row.ret_weight_3mo ?? 0.4),
    retWeight6mo: Number(row.ret_weight_6mo ?? 0.25),
    retWeight1yr: Number(row.ret_weight_1yr ?? 0.2),
    retWeight3yr: Number(row.ret_weight_3yr ?? 0.1),
    retWeight5yr: Number(row.ret_weight_5yr ?? 0.05),
    factorWeights: factorWeightsFromModelRow(row),
    incomeBudgetPct: Number(row.income_budget_pct ?? 0.12),
    volCapMultiplier: Number(row.vol_cap_multiplier ?? 3),
    themeCapPct: Number(row.theme_cap_pct ?? 0.1),
  };
}

export function modelAssumptionsToDbRow(
  portfolioId: string,
  sleeveType: SleeveType,
  assumptions: EngineAssumptions,
): Record<string, unknown> {
  const fw = normaliseFactorWeights(assumptions.factorWeights);
  return {
    portfolio_id: portfolioId,
    sleeve_type: sleeveType,
    ret_weight_3mo: assumptions.retWeight3mo,
    ret_weight_6mo: assumptions.retWeight6mo,
    ret_weight_1yr: assumptions.retWeight1yr,
    ret_weight_3yr: assumptions.retWeight3yr,
    ret_weight_5yr: assumptions.retWeight5yr,
    income_budget_pct: assumptions.incomeBudgetPct,
    vol_cap_multiplier: assumptions.volCapMultiplier,
    theme_cap_pct: assumptions.themeCapPct,
    score_weight_exp: fw.expense,
    score_weight_ret: fw.weightedReturn,
    score_weight_div: fw.divApy,
    score_weight_shp: fw.volatility,
    ...factorWeightsToDbPayload(fw),
    updated_at: new Date().toISOString(),
  };
}
