"use server";

import { createClient } from "@/lib/supabase/server";

export async function removeSleeve(sleeveId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  // Verify ownership
  const { data: sleeve } = await supabase
    .from("sleeves")
    .select("id, portfolio_id, portfolios(user_id)")
    .eq("id", sleeveId)
    .single();

  if (!sleeve) return { success: false, error: "Sleeve not found" };

  const portfolioUserId = (sleeve as { portfolios?: { user_id?: string } }).portfolios?.user_id;
  if (portfolioUserId !== user.id) return { success: false, error: "Forbidden" };

  // Do not allow deleting the last active sleeve
  const { count } = await supabase
    .from("sleeves")
    .select("id", { count: "exact", head: true })
    .eq("portfolio_id", (sleeve as { portfolio_id: string }).portfolio_id)
    .eq("is_active", true);

  if ((count ?? 0) <= 1) {
    return { success: false, error: "Cannot remove the last sleeve in a portfolio" };
  }

  // Soft-delete (cascade will handle holdings/snapshots on hard delete)
  const { error } = await supabase
    .from("sleeves")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", sleeveId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
