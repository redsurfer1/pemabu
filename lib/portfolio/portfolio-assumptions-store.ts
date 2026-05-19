import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool, isVaultDatabaseConfigured } from "@/lib/db";
import {
  DEFAULT_ASSUMPTIONS,
  normaliseWeights,
  type Assumptions,
} from "@/lib/portfolio/formula-engine";
import {
  factorWeightsFromDbRow,
  factorWeightsToDbPayload,
  factorWeightsToLegacyDbPayload,
  normaliseFactorWeights,
} from "@/lib/portfolio/portfolio-factors";
import { extractFactorValues, isMissingColumnError, FACTOR_COLUMNS } from "@/lib/portfolio/vault-assumptions";
import { toRecordOrNull } from "@/lib/supabase/typed";

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

async function readAssumptionsFromVault(portfolioId: string): Promise<Assumptions | null> {
  try {
    const { rows } = await getVaultPool().query<Record<string, unknown>>(
      `SELECT * FROM portfolio_assumptions WHERE portfolio_id = $1::uuid`,
      [portfolioId],
    );
    return rowToAssumptions(toRecordOrNull(rows[0]));
  } catch (err) {
    console.warn("[portfolio_assumptions] vault read failed:", err);
    return null;
  }
}

async function writeAssumptionsToVault(
  portfolioId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    await getVaultPool().query(
      `INSERT INTO portfolio_assumptions (
         portfolio_id, weight_3mo, weight_6mo, weight_1yr, weight_3yr, weight_5yr,
         ${FACTOR_COLUMNS.join(", ")}, updated_at
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
         ${FACTOR_COLUMNS.map((c) => `${c} = EXCLUDED.${c}`).join(",\n         ")},
         updated_at = EXCLUDED.updated_at`,
      [
        portfolioId,
        payload.weight_3mo,
        payload.weight_6mo,
        payload.weight_1yr,
        payload.weight_3yr,
        payload.weight_5yr,
        ...extractFactorValues(payload),
        payload.updated_at,
      ],
    );
    return true;
  } catch (err) {
    if (!isMissingColumnError(err)) {
      console.warn("[portfolio_assumptions] vault write failed:", err);
      return false;
    }
    const legacy = {
      ...payload,
      ...factorWeightsToLegacyDbPayload(
        normaliseFactorWeights({
          expense: Number(payload.factor_expense),
          pctWeight: Number(payload.factor_target_allocation ?? payload.factor_pct_weight),
          weightedReturn: Number(payload.factor_weighted_return ?? payload.factor_pct_weight),
          divApy: Number(payload.factor_div_apy),
          volatility: Number(payload.factor_volatility),
          thirteenF: Number(payload.factor_thirteen_f ?? 0),
          macroIntelligence: Number(payload.factor_macro_intelligence ?? 0),
          governanceLayer: Number(payload.factor_governance_layer ?? 0),
          politicalTracker: Number(payload.factor_political_tracker ?? 0),
          tokenQuality: Number(payload.factor_token_quality ?? 0),
        }),
      ),
    };
    delete legacy.factor_target_allocation;
    delete legacy.factor_weighted_return;
    delete legacy.factor_thirteen_f;
    delete legacy.factor_macro_intelligence;
    delete legacy.factor_governance_layer;
    delete legacy.factor_political_tracker;
    delete legacy.factor_token_quality;

    try {
      await getVaultPool().query(
        `INSERT INTO portfolio_assumptions (
           portfolio_id, weight_3mo, weight_6mo, weight_1yr, weight_3yr, weight_5yr,
           factor_expense, factor_pct_weight, factor_div_apy, factor_volatility, updated_at
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz)
         ON CONFLICT (portfolio_id) DO UPDATE SET
           weight_3mo = EXCLUDED.weight_3mo,
           weight_6mo = EXCLUDED.weight_6mo,
           weight_1yr = EXCLUDED.weight_1yr,
           weight_3yr = EXCLUDED.weight_3yr,
           weight_5yr = EXCLUDED.weight_5yr,
           factor_expense = EXCLUDED.factor_expense,
           factor_pct_weight = EXCLUDED.factor_pct_weight,
           factor_div_apy = EXCLUDED.factor_div_apy,
           factor_volatility = EXCLUDED.factor_volatility,
           updated_at = EXCLUDED.updated_at`,
        [
          portfolioId,
          legacy.weight_3mo,
          legacy.weight_6mo,
          legacy.weight_1yr,
          legacy.weight_3yr,
          legacy.weight_5yr,
          legacy.factor_expense,
          legacy.factor_pct_weight,
          legacy.factor_div_apy,
          legacy.factor_volatility,
          legacy.updated_at,
        ],
      );
      return true;
    } catch (legacyErr) {
      console.warn("[portfolio_assumptions] vault legacy write failed:", legacyErr);
      return false;
    }
  }
}

async function readAssumptionsFromSupabase(portfolioId: string): Promise<Assumptions> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_assumptions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .maybeSingle();
  if (error) {
    if (error.code === "42P01" || error.message?.includes("portfolio_assumptions")) {
      return { ...DEFAULT_ASSUMPTIONS };
    }
    throw error;
  }
  return rowToAssumptions(toRecordOrNull(data));
}

async function writeAssumptionsToSupabase(
  portfolioId: string,
  payload: Record<string, unknown>,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase.from("portfolio_assumptions").upsert(payload, {
    onConflict: "portfolio_id",
  });
  if (!error) return;

  if (!isMissingColumnError(error)) throw error;

  const legacyPayload = {
    portfolio_id: portfolioId,
    weight_3mo: payload.weight_3mo,
    weight_6mo: payload.weight_6mo,
    weight_1yr: payload.weight_1yr,
    weight_3yr: payload.weight_3yr,
    weight_5yr: payload.weight_5yr,
    ...factorWeightsToLegacyDbPayload(
      normaliseFactorWeights({
        expense: Number(payload.factor_expense),
        pctWeight: Number(payload.factor_target_allocation ?? payload.factor_pct_weight),
        weightedReturn: Number(payload.factor_weighted_return ?? payload.factor_pct_weight),
        divApy: Number(payload.factor_div_apy),
        volatility: Number(payload.factor_volatility),
        thirteenF: Number(payload.factor_thirteen_f ?? 0),
        macroIntelligence: Number(payload.factor_macro_intelligence ?? 0),
        governanceLayer: Number(payload.factor_governance_layer ?? 0),
        politicalTracker: Number(payload.factor_political_tracker ?? 0),
        tokenQuality: Number(payload.factor_token_quality ?? 0),
      }),
    ),
    updated_at: payload.updated_at,
  };

  const { error: legacyError } = await supabase
    .from("portfolio_assumptions")
    .upsert(legacyPayload, { onConflict: "portfolio_id" });
  if (legacyError) throw legacyError;
}

export async function getPortfolioAssumptions(portfolioId: string): Promise<Assumptions> {
  if (isVaultDatabaseConfigured()) {
    const fromVault = await readAssumptionsFromVault(portfolioId);
    if (fromVault) return fromVault;
  }
  return readAssumptionsFromSupabase(portfolioId);
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

  if (isVaultDatabaseConfigured()) {
    const ok = await writeAssumptionsToVault(portfolioId, payload);
    if (ok) return applied;
  }

  await writeAssumptionsToSupabase(portfolioId, payload, client);
  return applied;
}

export async function assertPortfolioOwnedByUser(
  portfolioId: string,
  userId: string,
): Promise<boolean> {
  if (isVaultDatabaseConfigured()) {
    try {
      const { rows } = await getVaultPool().query<{ ok: number }>(
        `SELECT 1 AS ok FROM portfolios WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
        [portfolioId, userId],
      );
      if (rows.length > 0) return true;
    } catch (err) {
      console.warn("[portfolio_assumptions] vault ownership check failed:", err);
    }
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
