import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";
import {
  engineAssumptionsFromModelRow,
  modelAssumptionsToDbRow,
} from "@/lib/portfolio/engine-assumptions-bridge";
import { assertPortfolioOwnedByUser } from "@/lib/portfolio/portfolio-assumptions-store";
import type { EngineAssumptions } from "@/types/allocation";
import { DEFAULT_ENGINE_ASSUMPTIONS } from "@/types/allocation";
import type { SleeveType } from "@/lib/types/database";

export type ModelAssumptionsBySleeve = {
  main: EngineAssumptions;
  income: EngineAssumptions;
};

const SLEEVE_TYPES: SleeveType[] = ["main", "income"];

function mapRows(rows: Record<string, unknown>[]): ModelAssumptionsBySleeve {
  const mainRow = rows.find((r) => r.sleeve_type === "main");
  const incomeRow = rows.find((r) => r.sleeve_type === "income");
  return {
    main: mainRow ? engineAssumptionsFromModelRow(mainRow) : { ...DEFAULT_ENGINE_ASSUMPTIONS },
    income: incomeRow ? engineAssumptionsFromModelRow(incomeRow) : { ...DEFAULT_ENGINE_ASSUMPTIONS },
  };
}

export async function getModelAssumptionsForPortfolio(
  portfolioId: string,
): Promise<ModelAssumptionsBySleeve> {
  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<Record<string, unknown>>(
      `SELECT * FROM model_assumptions WHERE portfolio_id = $1::uuid AND sleeve_type = ANY($2::text[])`,
      [portfolioId, SLEEVE_TYPES],
    );
    return mapRows(rows);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("model_assumptions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .in("sleeve_type", SLEEVE_TYPES);
  if (error) throw error;
  return mapRows((data ?? []) as Record<string, unknown>[]);
}

export async function upsertModelAssumptions(
  portfolioId: string,
  sleeveType: SleeveType,
  assumptions: EngineAssumptions,
  client?: SupabaseClient,
): Promise<void> {
  const payload = modelAssumptionsToDbRow(portfolioId, sleeveType, assumptions);

  if (isLocalVaultExecutionPlane()) {
    await getVaultPool().query(
      `INSERT INTO model_assumptions (
         portfolio_id, sleeve_type,
         ret_weight_3mo, ret_weight_6mo, ret_weight_1yr, ret_weight_3yr, ret_weight_5yr,
         score_weight_exp, score_weight_ret, score_weight_div, score_weight_shp,
         income_budget_pct, vol_cap_multiplier, theme_cap_pct,
         factor_expense, factor_target_allocation, factor_weighted_return, factor_pct_weight,
         factor_div_apy, factor_volatility, factor_thirteen_f, factor_macro_intelligence,
         factor_governance_layer, factor_political_tracker, factor_token_quality,
         updated_at
       ) VALUES (
         $1::uuid, $2,
         $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14,
         $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
         $26::timestamptz
       )
       ON CONFLICT (portfolio_id, sleeve_type) DO UPDATE SET
         ret_weight_3mo = EXCLUDED.ret_weight_3mo,
         ret_weight_6mo = EXCLUDED.ret_weight_6mo,
         ret_weight_1yr = EXCLUDED.ret_weight_1yr,
         ret_weight_3yr = EXCLUDED.ret_weight_3yr,
         ret_weight_5yr = EXCLUDED.ret_weight_5yr,
         score_weight_exp = EXCLUDED.score_weight_exp,
         score_weight_ret = EXCLUDED.score_weight_ret,
         score_weight_div = EXCLUDED.score_weight_div,
         score_weight_shp = EXCLUDED.score_weight_shp,
         income_budget_pct = EXCLUDED.income_budget_pct,
         vol_cap_multiplier = EXCLUDED.vol_cap_multiplier,
         theme_cap_pct = EXCLUDED.theme_cap_pct,
         factor_expense = EXCLUDED.factor_expense,
         factor_target_allocation = EXCLUDED.factor_target_allocation,
         factor_weighted_return = EXCLUDED.factor_weighted_return,
         factor_pct_weight = EXCLUDED.factor_pct_weight,
         factor_div_apy = EXCLUDED.factor_div_apy,
         factor_volatility = EXCLUDED.factor_volatility,
         factor_thirteen_f = EXCLUDED.factor_thirteen_f,
         factor_macro_intelligence = EXCLUDED.factor_macro_intelligence,
         factor_governance_layer = EXCLUDED.factor_governance_layer,
         factor_political_tracker = EXCLUDED.factor_political_tracker,
         factor_token_quality = EXCLUDED.factor_token_quality,
         updated_at = EXCLUDED.updated_at`,
      [
        portfolioId,
        sleeveType,
        payload.ret_weight_3mo,
        payload.ret_weight_6mo,
        payload.ret_weight_1yr,
        payload.ret_weight_3yr,
        payload.ret_weight_5yr,
        payload.score_weight_exp,
        payload.score_weight_ret,
        payload.score_weight_div,
        payload.score_weight_shp,
        payload.income_budget_pct,
        payload.vol_cap_multiplier,
        payload.theme_cap_pct,
        payload.factor_expense,
        payload.factor_target_allocation,
        payload.factor_weighted_return,
        payload.factor_pct_weight,
        payload.factor_div_apy,
        payload.factor_volatility,
        payload.factor_thirteen_f,
        payload.factor_macro_intelligence,
        payload.factor_governance_layer,
        payload.factor_political_tracker,
        payload.factor_token_quality,
        payload.updated_at,
      ],
    );
    return;
  }

  const supabase = client ?? (await createClient());
  const { error } = await supabase.from("model_assumptions").upsert(payload, {
    onConflict: "portfolio_id,sleeve_type",
  });
  if (error) throw error;
}

export async function getModelAssumptionsForPortfolioIfOwned(
  portfolioId: string,
  userId: string,
): Promise<ModelAssumptionsBySleeve | null> {
  const owned = await assertPortfolioOwnedByUser(portfolioId, userId);
  if (!owned) return null;
  return getModelAssumptionsForPortfolio(portfolioId);
}
