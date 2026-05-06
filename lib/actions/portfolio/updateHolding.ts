"use server";

import { createClient } from "@/lib/supabase/server";

interface UpdateHoldingInput {
  qty?: number;
  theme?: string;
  expenseRatio?: number;
  divDollar?: number;
  manualTargetWt?: number | null;
}

export async function updateHolding(holdingId: string, data: UpdateHoldingInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  // Verify ownership via join
  const { data: holding } = await supabase
    .from("sleeve_holdings")
    .select("id, sleeves(portfolios(user_id))")
    .eq("id", holdingId)
    .single();

  if (!holding) return { success: false, error: "Holding not found" };
  const portfolioUserId = (holding as {
    sleeves?: { portfolios?: { user_id?: string } };
  }).sleeves?.portfolios?.user_id;
  if (portfolioUserId !== user.id) return { success: false, error: "Forbidden" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.qty !== undefined) patch.qty = data.qty;
  if (data.theme !== undefined) patch.theme = data.theme;
  if (data.expenseRatio !== undefined) patch.expense_ratio = data.expenseRatio;
  if (data.divDollar !== undefined) patch.div_dollar = data.divDollar;
  if (data.manualTargetWt !== undefined) {
    patch.manual_target_wt = data.manualTargetWt;
    patch.target_wt_pct = data.manualTargetWt ?? 0;
  }

  const { error } = await supabase
    .from("sleeve_holdings")
    .update(patch)
    .eq("id", holdingId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
