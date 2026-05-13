"use server";

import { createClient } from "@/lib/supabase/server";
import type { SleevePurpose, SleeveWeightingMethod } from "@/types/allocation";

interface CreateSleeveInput {
  name: string;
  purpose: SleevePurpose;
  budgetPct: number;
  weightingMethod: SleeveWeightingMethod;
  sortOrder?: number;
}

export async function createSleeve(portfolioId: string, data: CreateSleeveInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  // Validate budget: sum of existing + new must not exceed 1.0
  const { data: existing } = await supabase
    .from("sleeves")
    .select("budget_pct")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true);

  const existingTotal = (existing ?? []).reduce((s: number, r: { budget_pct: number }) => s + Number(r.budget_pct), 0);
  if (existingTotal + data.budgetPct > 1.001) {
    return {
      success: false,
      error: `Adding ${(data.budgetPct * 100).toFixed(0)}% would exceed 100% total (current: ${(existingTotal * 100).toFixed(0)}%)`,
    };
  }

  const maxOrder = (existing ?? []).reduce((m: number, _: unknown, i: number) => Math.max(m, i), 0);
  const sortOrder = data.sortOrder ?? maxOrder + 1;

  const { data: sleeve, error } = await supabase
    .from("sleeves")
    .insert({
      portfolio_id: portfolioId,
      name: data.name,
      purpose: data.purpose,
      budget_pct: data.budgetPct,
      weighting_method: data.weightingMethod,
      sort_order: sortOrder,
      is_active: true,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, sleeve };
}

export { createSleeve as addSleeve };
