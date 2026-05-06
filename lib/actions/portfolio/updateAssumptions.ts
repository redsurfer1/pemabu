"use server";

import { createClient } from "@/lib/supabase/server";
import type { EngineAssumptions } from "@/types/allocation";

export async function updateAssumptions(
  portfolioId: string,
  assumptions: Partial<EngineAssumptions>,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  // Load existing to merge
  const { data: existing } = await supabase
    .from("model_assumptions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .maybeSingle();

  const merged: EngineAssumptions = {
    retWeight3mo: Number(existing?.ret_weight_3mo ?? 0.40),
    retWeight6mo: Number(existing?.ret_weight_6mo ?? 0.25),
    retWeight1yr: Number(existing?.ret_weight_1yr ?? 0.20),
    retWeight3yr: Number(existing?.ret_weight_3yr ?? 0.10),
    retWeight5yr: Number(existing?.ret_weight_5yr ?? 0.05),
    scoreWeightExp: Number(existing?.score_weight_exp ?? 0.30),
    scoreWeightRet: Number(existing?.score_weight_ret ?? 0.30),
    scoreWeightDiv: Number(existing?.score_weight_div ?? 0.15),
    scoreWeightShp: Number(existing?.score_weight_shp ?? 0.25),
    incomeBudgetPct: Number(existing?.income_budget_pct ?? 0.12),
    volCapMultiplier: Number(existing?.vol_cap_multiplier ?? 3.0),
    themeCapPct: Number(existing?.theme_cap_pct ?? 0.10),
    ...assumptions,
  };

  // Validate weight sums (tolerance 0.001)
  const retSum =
    merged.retWeight3mo + merged.retWeight6mo + merged.retWeight1yr +
    merged.retWeight3yr + merged.retWeight5yr;
  if (Math.abs(retSum - 1) > 0.001) {
    return { success: false, error: `Return weights sum to ${retSum.toFixed(4)}, must equal 1.0` };
  }

  const scoreSum =
    merged.scoreWeightExp + merged.scoreWeightRet +
    merged.scoreWeightDiv + merged.scoreWeightShp;
  if (Math.abs(scoreSum - 1) > 0.001) {
    return { success: false, error: `Score weights sum to ${scoreSum.toFixed(4)}, must equal 1.0` };
  }

  const { error } = await supabase.from("model_assumptions").upsert(
    {
      portfolio_id: portfolioId,
      ret_weight_3mo: merged.retWeight3mo,
      ret_weight_6mo: merged.retWeight6mo,
      ret_weight_1yr: merged.retWeight1yr,
      ret_weight_3yr: merged.retWeight3yr,
      ret_weight_5yr: merged.retWeight5yr,
      score_weight_exp: merged.scoreWeightExp,
      score_weight_ret: merged.scoreWeightRet,
      score_weight_div: merged.scoreWeightDiv,
      score_weight_shp: merged.scoreWeightShp,
      income_budget_pct: merged.incomeBudgetPct,
      vol_cap_multiplier: merged.volCapMultiplier,
      theme_cap_pct: merged.themeCapPct,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "portfolio_id" },
  );

  if (error) return { success: false, error: error.message };
  return { success: true, assumptions: merged };
}
