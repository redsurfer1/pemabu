"use server";

import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { createClient } from "@/lib/supabase/server";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier, tierMeetsMinimum, type PemabuTier } from "@/lib/security/tier-guard";
import { assertMarketplaceImportUnlock } from "@/lib/marketplace/assert-import-unlock";
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

  let gate: Awaited<ReturnType<typeof assertMarketplaceImportUnlock>>;
  try {
    gate = await assertMarketplaceImportUnlock(user.id, sleeveToken);
  } catch {
    return { success: false as const, error: "Marketplace lookup failed" };
  }
  if (!gate.ok) {
    return {
      success: false as const,
      error: gate.message,
      code: "PAYMENT_REQUIRED" as const,
    };
  }

  const out = await importSleeveStrategy(user.id, portfolioId, sleeveToken);
  if (!out.ok) return { success: false as const, error: out.error };

  const { error: refreshErr } = await supabaseAdmin.rpc("refresh_leaderboard_scores");
  if (refreshErr) {
    console.error("refresh_leaderboard_scores:", refreshErr.message);
  }

  return { success: true as const, sleeveId: out.sleeveId };
}
