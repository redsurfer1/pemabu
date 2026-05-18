"use server";

import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { createClient } from "@/lib/supabase/server";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier, tierMeetsMinimum, type PemabuTier } from "@/lib/security/tier-guard";
import { enforceImportEntitlement, ImportEntitlementError } from "@/lib/marketplace/import-gate";
import { spendImportToken } from "@/lib/marketplace/import-token-service";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function importSleeveStrategyAction(portfolioId: string, sleeveToken: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Unauthenticated" };

  const keys = await getActiveServiceKeysForUser(user.id);
  const t = resolveEffectiveTier(keys);
  if (!tierMeetsMinimum(t, "INTELLIGENCE")) {
    const required: PemabuTier = "INTELLIGENCE";
    return {
      success: false as const,
      error: "Intelligence tier required",
      code: "TIER_REQUIRED" as const,
      requiredTier: required,
    };
  }

  try {
    await enforceImportEntitlement(user.id, sleeveToken);
  } catch (err) {
    if (err instanceof ImportEntitlementError) {
      return {
        success: false as const,
        error: err.message,
        code: "PAYMENT_REQUIRED" as const,
      };
    }
    return { success: false as const, error: "Marketplace lookup failed" };
  }

  const out = await importSleeveStrategy(user.id, portfolioId, sleeveToken);
  if (!out.ok) return { success: false as const, error: out.error };

  // Spend one import token after a successful import (ledger path only).
  if (process.env.MARKETPLACE_USE_IMPORT_LEDGER !== "false") {
    const idempotencyKey = `${user.id}:${sleeveToken.slice(0, 32)}:${Math.floor(Date.now() / 60_000)}`;
    try {
      await spendImportToken({
        userId: user.id,
        strategyId: null,
        strategySlug: out.sleeveId,
        portfolioId,
        idempotencyKey,
      });
    } catch (e) {
      console.error("[importSleeveStrategyAction] Token spend failed after successful import:", e);
    }
  }

  // Fire-and-forget leaderboard refresh — does not block import response (Task Group I)
  void (async () => {
    const { error: refreshErr } = await supabaseAdmin.rpc("refresh_leaderboard_scores");
    if (refreshErr) {
      console.error("refresh_leaderboard_scores (non-fatal):", refreshErr.message);
    }
  })();

  return { success: true as const, sleeveId: out.sleeveId };
}
