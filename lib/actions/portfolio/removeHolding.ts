"use server";

import { insertHoldingAuditRow } from "@/lib/portfolio/holding-audit";
import { d } from "@/lib/portfolio/precision-money";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RemoveHoldingMode = "partial" | "full";

export interface RemoveHoldingInput {
  mode: RemoveHoldingMode;
  /** Shares / units to sell when mode === partial */
  quantity?: number | string;
}

async function navShareOfHolding(
  supabase: SupabaseClient,
  portfolioId: string,
  qty: ReturnType<typeof d>,
  price: ReturnType<typeof d>,
): Promise<ReturnType<typeof d> | null> {
  const { data: sleeves } = await supabase
    .from("sleeves")
    .select("id")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true);
  const sleeveIds = (sleeves ?? []).map((s: { id: string }) => s.id);
  if (sleeveIds.length === 0) return null;
  const { data: rows } = await supabase
    .from("sleeve_holdings")
    .select("qty, price_seed")
    .in("sleeve_id", sleeveIds);
  let total = d(0);
  for (const r of rows ?? []) {
    const row = r as { qty: string | number; price_seed: string | number };
    total = total.plus(d(row.qty).mul(d(row.price_seed)));
  }
  const mine = qty.mul(price);
  if (total.isZero()) return null;
  return mine.div(total);
}

/**
 * Partial sell reduces quantity (and scales cost basis proportionally).
 * Full exit deletes the row and records drift context for downstream signals.
 */
export async function removeHolding(holdingId: string, input: RemoveHoldingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const { data: holding } = await supabase
    .from("sleeve_holdings")
    .select("id, sleeve_id, ticker, qty, cost_basis, price_seed, sleeves(id, portfolio_id, portfolios(user_id))")
    .eq("id", holdingId)
    .single();

  if (!holding) return { success: false, error: "Holding not found" };

  const row = holding as unknown as {
    id: string;
    sleeve_id: string;
    ticker: string;
    qty: string | number;
    cost_basis: number | null;
    price_seed: string | number;
    sleeves:
      | { id: string; portfolio_id: string; portfolios: { user_id: string } | { user_id: string }[] | null }
      | { id: string; portfolio_id: string; portfolios: { user_id: string } | { user_id: string }[] | null }[]
      | null;
  };

  const sleeveJoin = Array.isArray(row.sleeves) ? row.sleeves[0] : row.sleeves;
  if (!sleeveJoin) return { success: false, error: "Sleeve not found" };

  const portfoliosJoin = sleeveJoin.portfolios;
  const portfolioUserId = Array.isArray(portfoliosJoin)
    ? portfoliosJoin[0]?.user_id
    : portfoliosJoin?.user_id;

  if (portfolioUserId !== user.id) return { success: false, error: "Forbidden" };

  const portfolioId = sleeveJoin.portfolio_id;
  const sleeveId = sleeveJoin.id;
  const qtyBefore = d(row.qty);
  const costBefore = row.cost_basis;
  const costDec = costBefore !== null && costBefore !== undefined ? d(costBefore) : null;
  const price = d(row.price_seed);

  if (input.mode === "full") {
    const navShareBefore = await navShareOfHolding(supabase, portfolioId, qtyBefore, price);

    const { error: auditErr } = await insertHoldingAuditRow(supabase, {
      userId: user.id,
      portfolioId,
      sleeveId,
      holdingId,
      eventType: "FULL_EXIT",
      ticker: row.ticker,
      quantityBefore: qtyBefore.toString(),
      quantityAfter: 0,
      costBasisBefore: costDec?.toString() ?? null,
      costBasisAfter: 0,
      notes: { mode: "full" },
    });
    if (auditErr) return { success: false, error: auditErr };

    if (navShareBefore !== null) {
      const { error: driftErr } = await insertHoldingAuditRow(supabase, {
        userId: user.id,
        portfolioId,
        sleeveId,
        holdingId,
        eventType: "DRIFT_AFTER_REMOVAL",
        ticker: row.ticker,
        quantityBefore: qtyBefore.toString(),
        quantityAfter: 0,
        costBasisBefore: costDec?.toString() ?? null,
        costBasisAfter: 0,
        notes: {
          priorValueShareOfPortfolio: navShareBefore.toString(),
          trigger: "full_exit",
        },
      });
      if (driftErr) return { success: false, error: driftErr };
    }

    const { error: delErr } = await supabase.from("sleeve_holdings").delete().eq("id", holdingId);
    if (delErr) return { success: false, error: delErr.message };
    return { success: true };
  }

  const sellQty = d(input.quantity ?? 0);
  if (!sellQty.isFinite() || sellQty.lte(0)) {
    return { success: false, error: "Partial removal requires a positive quantity" };
  }
  if (sellQty.gt(qtyBefore)) {
    return { success: false, error: "Sell quantity exceeds position size" };
  }

  const qtyAfter = qtyBefore.minus(sellQty);
  let newCost: string | null = null;
  if (costDec && !qtyBefore.isZero()) {
    newCost = costDec.mul(qtyAfter.div(qtyBefore)).toFixed(4);
  }

  const { error: auditErr } = await insertHoldingAuditRow(supabase, {
    userId: user.id,
    portfolioId,
    sleeveId,
    holdingId,
    eventType: "PARTIAL_SELL",
    ticker: row.ticker,
    quantityBefore: qtyBefore.toString(),
    quantityAfter: qtyAfter.toString(),
    costBasisBefore: costDec?.toString() ?? null,
    costBasisAfter: newCost,
    notes: { sold: sellQty.toString() },
  });
  if (auditErr) return { success: false, error: auditErr };

  const { error: updErr } = await supabase
    .from("sleeve_holdings")
    .update({
      qty: qtyAfter.toString(),
      cost_basis: newCost !== null ? Number(newCost) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holdingId);

  if (updErr) return { success: false, error: updErr.message };
  return { success: true };
}
