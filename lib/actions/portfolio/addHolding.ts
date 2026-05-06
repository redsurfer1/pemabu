"use server";

import { createClient } from "@/lib/supabase/server";
import type { HoldingStatus } from "@/types/allocation";

interface AddHoldingInput {
  ticker: string;
  name: string;
  status: HoldingStatus;
  theme: string;
  qty: number;
  expenseRatio: number;
  divDollar: number;
  manualPricing?: boolean;
  manualTargetWt?: number;
  sortOrder?: number;
}

export async function addHolding(sleeveId: string, data: AddHoldingInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  // Verify sleeve belongs to user
  const { data: sleeve } = await supabase
    .from("sleeves")
    .select("id, portfolios(user_id)")
    .eq("id", sleeveId)
    .single();

  if (!sleeve) return { success: false, error: "Sleeve not found" };
  const portfolioUserId = (sleeve as { portfolios?: { user_id?: string } }).portfolios?.user_id;
  if (portfolioUserId !== user.id) return { success: false, error: "Forbidden" };

  const { data: holding, error } = await supabase
    .from("sleeve_holdings")
    .insert({
      sleeve_id: sleeveId,
      ticker: data.ticker.toUpperCase(),
      name: data.name,
      status: data.status,
      theme: data.theme,
      qty: data.qty,
      price_seed: 0,
      expense_ratio: data.expenseRatio,
      div_dollar: data.divDollar,
      manual_pricing: data.manualPricing ?? false,
      manual_target_wt: data.manualTargetWt ?? null,
      sort_order: data.sortOrder ?? 0,
      target_wt_pct: data.manualTargetWt ?? 0,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, holding };
}
