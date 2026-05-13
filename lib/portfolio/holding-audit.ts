import type { SupabaseClient } from "@supabase/supabase-js";

export type HoldingAuditEventType =
  | "ADD"
  | "PARTIAL_SELL"
  | "FULL_EXIT"
  | "SLEEVE_REMOVED"
  | "DRIFT_AFTER_REMOVAL"
  | "TRADE_PROPOSAL_CREATED"
  | "TRADE_PROPOSAL_APPROVED"
  | "TRADE_PROPOSAL_REJECTED"
  | "TRADE_EXECUTION_ATTEMPT"
  | "TRADE_EXECUTION_SUCCESS"
  | "TRADE_EXECUTION_FAILURE"
  | "STRATEGY_IMPORT_SUCCESS";

export interface HoldingAuditInsert {
  userId: string;
  portfolioId: string;
  sleeveId: string | null;
  holdingId: string | null;
  eventType: HoldingAuditEventType;
  ticker: string;
  quantityBefore: string | number | null;
  quantityAfter: string | number | null;
  costBasisBefore: string | number | null;
  costBasisAfter: string | number | null;
  notes?: Record<string, unknown>;
}

export async function insertHoldingAuditRow(
  supabase: SupabaseClient,
  row: HoldingAuditInsert,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("holding_audit_log").insert({
    user_id: row.userId,
    portfolio_id: row.portfolioId,
    sleeve_id: row.sleeveId,
    holding_id: row.holdingId,
    event_type: row.eventType,
    ticker: row.ticker,
    quantity_before: row.quantityBefore,
    quantity_after: row.quantityAfter,
    cost_basis_before: row.costBasisBefore,
    cost_basis_after: row.costBasisAfter,
    notes: row.notes ?? {},
  });
  return { error: error?.message ?? null };
}
