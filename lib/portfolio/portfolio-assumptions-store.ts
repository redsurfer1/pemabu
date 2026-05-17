import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";
import {
  DEFAULT_ASSUMPTIONS,
  normaliseWeights,
  type Assumptions,
} from "@/lib/portfolio/formula-engine";
import {
  factorWeightsFromDbRow,
  factorWeightsToDbPayload,
  normaliseFactorWeights,
} from "@/lib/portfolio/portfolio-factors";

function rowToAssumptions(row: Record<string, unknown> | null): Assumptions {
  if (!row) return { ...DEFAULT_ASSUMPTIONS };
  return {
    return_weights: {
      r3mo: Number(row.weight_3mo ?? DEFAULT_ASSUMPTIONS.return_weights.r3mo),
      r6mo: Number(row.weight_6mo ?? DEFAULT_ASSUMPTIONS.return_weights.r6mo),
      r1yr: Number(row.weight_1yr ?? DEFAULT_ASSUMPTIONS.return_weights.r1yr),
      r3yr: Number(row.weight_3yr ?? DEFAULT_ASSUMPTIONS.return_weights.r3yr),
      r5yr: Number(row.weight_5yr ?? DEFAULT_ASSUMPTIONS.return_weights.r5yr),
    },
    factor_weights: factorWeightsFromDbRow(row),
  };
}

function assumptionsToDbPayload(portfolioId: string, assumptions: Assumptions): Record<string, unknown> {
  const rw = normaliseWeights(assumptions.return_weights);
  const fw = normaliseFactorWeights(assumptions.factor_weights);
  return {
    portfolio_id: portfolioId,
    weight_3mo: rw.r3mo,
    weight_6mo: rw.r6mo,
    weight_1yr: rw.r1yr,
    weight_3yr: rw.r3yr,
    weight_5yr: rw.r5yr,
    ...factorWeightsToDbPayload(fw),
    updated_at: new Date().toISOString(),
  };
}

export async function getPortfolioAssumptions(portfolioId: string): Promise<Assumptions> {
  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<Record<string, unknown>>(
      `SELECT * FROM portfolio_assumptions WHERE portfolio_id = $1::uuid`,
      [portfolioId],
    );
    return rowToAssumptions(rows[0] ?? null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_assumptions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .maybeSingle();
  if (error) throw error;
  return rowToAssumptions((data as Record<string, unknown> | null) ?? null);
}

export async function upsertPortfolioAssumptions(
  portfolioId: string,
  assumptions: Assumptions,
  client?: SupabaseClient,
): Promise<Assumptions> {
  const applied: Assumptions = {
    return_weights: normaliseWeights(assumptions.return_weights),
    factor_weights: normaliseFactorWeights(assumptions.factor_weights),
  };
  const payload = assumptionsToDbPayload(portfolioId, applied);

  if (isLocalVaultExecutionPlane()) {
    await getVaultPool().query(
      `INSERT INTO portfolio_assumptions (
         portfolio_id, weight_3mo, weight_6mo, weight_1yr, weight_3yr, weight_5yr,
         factor_expense, factor_target_allocation, factor_weighted_return, factor_pct_weight,
         factor_div_apy, factor_volatility, factor_thirteen_f, factor_macro_intelligence,
         factor_governance_layer, factor_political_tracker, factor_token_quality, updated_at
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::timestamptz
       )
       ON CONFLICT (portfolio_id) DO UPDATE SET
         weight_3mo = EXCLUDED.weight_3mo,
         weight_6mo = EXCLUDED.weight_6mo,
         weight_1yr = EXCLUDED.weight_1yr,
         weight_3yr = EXCLUDED.weight_3yr,
         weight_5yr = EXCLUDED.weight_5yr,
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
        payload.weight_3mo,
        payload.weight_6mo,
        payload.weight_1yr,
        payload.weight_3yr,
        payload.weight_5yr,
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
    return applied;
  }

  const supabase = client ?? (await createClient());
  const { error } = await supabase.from("portfolio_assumptions").upsert(payload, {
    onConflict: "portfolio_id",
  });
  if (error) throw error;
  return applied;
}

export async function assertPortfolioOwnedByUser(
  portfolioId: string,
  userId: string,
): Promise<boolean> {
  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<{ ok: number }>(
      `SELECT 1 AS ok FROM portfolios WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
      [portfolioId, userId],
    );
    return rows.length > 0;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();
  return data != null;
}
