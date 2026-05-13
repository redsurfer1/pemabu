"use server";

import { insertHoldingAuditRow } from "@/lib/portfolio/holding-audit";
import { isAutonomous } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";
import { ensureExecutionControlRow } from "@/lib/execution/guardrails";
import {
  ensureExecutionControlRowVault,
  insertHoldingAuditVault,
  listPendingTradeProposalsVault,
  updateExecutionControlVault,
  updateTradeProposalStatusVault,
  isLocalVaultExecutionPlane,
} from "@/lib/execution/vault-execution-plane";

export async function setKillSwitch(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const keys = await getActiveServiceKeysForUser(user.id);
  if (!isAutonomous(keys)) return { success: false, error: "Autonomous tier required" };

  const vault = isLocalVaultExecutionPlane();

  if (vault) {
    await ensureExecutionControlRowVault(user.id);
    await updateExecutionControlVault(user.id, { kill_switch_enabled: enabled });
    if (!enabled) {
      const pending = await listPendingTradeProposalsVault(user.id);
      for (const p of pending) {
        await updateTradeProposalStatusVault(p.id, "REJECTED");
        await insertHoldingAuditVault({
          userId: user.id,
          portfolioId: p.portfolio_id,
          sleeveId: p.sleeve_id,
          holdingId: p.holding_id,
          eventType: "TRADE_PROPOSAL_REJECTED",
          ticker: p.ticker,
          quantityBefore: null,
          quantityAfter: p.quantity,
          costBasisBefore: null,
          costBasisAfter: null,
          notes: { reason: "KILL_SWITCH_OFF", proposalId: p.id },
        });
      }
    }
    return { success: true };
  }

  await ensureExecutionControlRow(supabase, user.id);

  const { error } = await supabase
    .from("execution_control")
    .update({
      kill_switch_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  if (!enabled) {
    const { data: pending } = await supabase
      .from("trade_proposals")
      .select("id, portfolio_id, sleeve_id, holding_id, ticker, quantity")
      .eq("user_id", user.id)
      .eq("status", "PENDING");

    for (const p of pending ?? []) {
      const row = p as {
        id: string;
        portfolio_id: string;
        sleeve_id: string;
        holding_id: string | null;
        ticker: string;
        quantity: string;
      };
      await supabase
        .from("trade_proposals")
        .update({ status: "REJECTED", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      await insertHoldingAuditRow(supabase, {
        userId: user.id,
        portfolioId: row.portfolio_id,
        sleeveId: row.sleeve_id,
        holdingId: row.holding_id,
        eventType: "TRADE_PROPOSAL_REJECTED",
        ticker: row.ticker,
        quantityBefore: null,
        quantityAfter: row.quantity,
        costBasisBefore: null,
        costBasisAfter: null,
        notes: { reason: "KILL_SWITCH_OFF", proposalId: row.id },
      });
    }
  }

  return { success: true };
}
