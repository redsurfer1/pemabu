"use server";

import { insertHoldingAuditRow } from "@/lib/portfolio/holding-audit";
import { d } from "@/lib/portfolio/precision-money";
import { createClient } from "@/lib/supabase/server";
import type { HoldingStatus } from "@/types/allocation";

export interface AddHoldingInput {
  ticker: string;
  name: string;
  status: HoldingStatus;
  theme: string;
  qty: number | string;
  /** Total position cost basis (optional). */
  costBasis?: number | string | null;
  expenseRatio: number;
  divDollar: number;
  manualPricing?: boolean;
  manualTargetWt?: number;
  sortOrder?: number;
  /** When set, duplicate tickers are allowed as separate tax lots in the same sleeve. */
  taxLotLabel?: string | null;
  rsi14?: number | string | null;
}

export async function addHolding(sleeveId: string, data: AddHoldingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const qtyDec = d(data.qty);
  if (!qtyDec.isFinite() || qtyDec.lte(0)) {
    return { success: false, error: "Quantity must be a positive decimal value" };
  }

  const ticker = data.ticker.trim().toUpperCase();
  const lot = data.taxLotLabel?.trim() || null;

  const { data: sleeve } = await supabase
    .from("sleeves")
    .select("id, portfolio_id, portfolios(user_id)")
    .eq("id", sleeveId)
    .single();

  if (!sleeve) return { success: false, error: "Sleeve not found" };
  const portfolioUserId = (sleeve as { portfolios?: { user_id?: string } }).portfolios?.user_id;
  if (portfolioUserId !== user.id) return { success: false, error: "Forbidden" };

  const portfolioId = (sleeve as { portfolio_id: string }).portfolio_id;

  if (!lot) {
    const { data: dup } = await supabase
      .from("sleeve_holdings")
      .select("id")
      .eq("sleeve_id", sleeveId)
      .eq("ticker", ticker)
      .maybeSingle();
    if (dup) {
      return {
        success: false,
        error:
          "Duplicate ticker in this sleeve. Use a separate tax lot label, consolidate lots, or adjust the existing row.",
      };
    }
  } else {
    const { data: dupLot } = await supabase
      .from("sleeve_holdings")
      .select("id")
      .eq("sleeve_id", sleeveId)
      .eq("ticker", ticker)
      .eq("tax_lot_label", lot)
      .maybeSingle();
    if (dupLot) {
      return { success: false, error: "Duplicate tax lot label for this ticker in the sleeve." };
    }
  }

  const costBasisNum =
    data.costBasis === undefined || data.costBasis === null || data.costBasis === ""
      ? null
      : Number(d(data.costBasis).toFixed(4));

  const { data: holding, error } = await supabase
    .from("sleeve_holdings")
    .insert({
      sleeve_id: sleeveId,
      ticker,
      name: data.name,
      status: data.status,
      theme: data.theme,
      qty: qtyDec.toString(),
      price_seed: 0,
      expense_ratio: data.expenseRatio,
      div_dollar: data.divDollar,
      manual_pricing: data.manualPricing ?? false,
      manual_target_wt: data.manualTargetWt ?? null,
      sort_order: data.sortOrder ?? 0,
      target_wt_pct: data.manualTargetWt ?? 0,
      cost_basis: costBasisNum,
      tax_lot_label: lot,
      rsi_14:
        data.rsi14 === undefined || data.rsi14 === null || data.rsi14 === ""
          ? null
          : Number(d(data.rsi14).toFixed(4)),
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  const hid = (holding as { id: string }).id;
  const { error: auditErr } = await insertHoldingAuditRow(supabase, {
    userId: user.id,
    portfolioId,
    sleeveId,
    holdingId: hid,
    eventType: "ADD",
    ticker,
    quantityBefore: 0,
    quantityAfter: qtyDec.toString(),
    costBasisBefore: 0,
    costBasisAfter: costBasisNum,
    notes: { taxLotLabel: lot },
  });
  if (auditErr) return { success: false, error: auditErr };

  return { success: true, holding };
}
