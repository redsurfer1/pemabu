"use server";

import { insertHoldingAuditRow } from "@/lib/portfolio/holding-audit";
import { createClient } from "@/lib/supabase/server";

/**
 * Hard-removes a sleeve after auditing each holding. Cascades delete `sleeve_holdings`
 * (and snapshots). Ensures no orphaned holdings and at least one active sleeve remains.
 */
export async function removeSleeve(sleeveId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const { data: sleeve } = await supabase
    .from("sleeves")
    .select("id, portfolio_id, portfolios(user_id)")
    .eq("id", sleeveId)
    .single();

  if (!sleeve) return { success: false, error: "Sleeve not found" };

  const portfolioUserId = (sleeve as { portfolios?: { user_id?: string } }).portfolios?.user_id;
  if (portfolioUserId !== user.id) return { success: false, error: "Forbidden" };

  const portfolioId = (sleeve as { portfolio_id: string }).portfolio_id;

  const { count: activeCount } = await supabase
    .from("sleeves")
    .select("id", { count: "exact", head: true })
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true);

  if ((activeCount ?? 0) <= 1) {
    return { success: false, error: "Cannot remove the last sleeve in a portfolio" };
  }

  const { data: holdings } = await supabase
    .from("sleeve_holdings")
    .select("id, ticker, qty, cost_basis")
    .eq("sleeve_id", sleeveId);

  for (const h of holdings ?? []) {
    const { error: aerr } = await insertHoldingAuditRow(supabase, {
      userId: user.id,
      portfolioId,
      sleeveId,
      holdingId: h.id,
      eventType: "FULL_EXIT",
      ticker: h.ticker,
      quantityBefore: h.qty,
      quantityAfter: 0,
      costBasisBefore: h.cost_basis,
      costBasisAfter: 0,
      notes: { reason: "sleeve_removed" },
    });
    if (aerr) return { success: false, error: aerr };
  }

  const { error: sleeveAuditErr } = await insertHoldingAuditRow(supabase, {
    userId: user.id,
    portfolioId,
    sleeveId,
    holdingId: null,
    eventType: "SLEEVE_REMOVED",
    ticker: "_SLEEVE_",
    quantityBefore: null,
    quantityAfter: null,
    costBasisBefore: null,
    costBasisAfter: null,
    notes: { sleeveId, holdingCount: holdings?.length ?? 0 },
  });
  if (sleeveAuditErr) return { success: false, error: sleeveAuditErr };

  const { error: delErr } = await supabase.from("sleeves").delete().eq("id", sleeveId);
  if (delErr) return { success: false, error: delErr.message };

  return { success: true };
}
