"use server";

import { createClient } from "@/lib/supabase/server";
import type { EngineAssumptions } from "@/types/allocation";
import { DEFAULT_ENGINE_ASSUMPTIONS } from "@/types/allocation";
import { engineAssumptionsFromModelRow } from "@/lib/portfolio/engine-assumptions-bridge";
import {
  getModelAssumptionsForPortfolio,
  upsertModelAssumptions,
} from "@/lib/portfolio/model-assumptions-store";
import { normaliseFactorWeights, sumFactorWeights } from "@/lib/portfolio/portfolio-factors";

export async function updateAssumptions(
  portfolioId: string,
  assumptions: Partial<EngineAssumptions>,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const existingBySleeve = await getModelAssumptionsForPortfolio(portfolioId);
  const merged: EngineAssumptions = {
    ...existingBySleeve.main,
    ...assumptions,
    factorWeights: normaliseFactorWeights({
      ...existingBySleeve.main.factorWeights,
      ...(assumptions.factorWeights ?? {}),
    }),
  };

  const retSum =
    merged.retWeight3mo +
    merged.retWeight6mo +
    merged.retWeight1yr +
    merged.retWeight3yr +
    merged.retWeight5yr;
  if (Math.abs(retSum - 1) > 0.001) {
    return { success: false, error: `Return weights sum to ${retSum.toFixed(4)}, must equal 1.0` };
  }

  const factorSum = sumFactorWeights(merged.factorWeights).toNumber();
  if (Math.abs(factorSum - 1) > 0.001) {
    return { success: false, error: `Factor weights sum to ${factorSum.toFixed(4)}, must equal 1.0` };
  }

  try {
    await upsertModelAssumptions(portfolioId, "main", merged, supabase);
    return { success: true, assumptions: merged };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** @deprecated Use getModelAssumptionsForPortfolio — kept for callers expecting a single row. */
export function parseModelAssumptionsRow(row: Record<string, unknown> | null): EngineAssumptions {
  if (!row) return { ...DEFAULT_ENGINE_ASSUMPTIONS };
  return engineAssumptionsFromModelRow(row);
}
