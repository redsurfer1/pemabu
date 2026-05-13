"use server";

import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { createClient } from "@/lib/supabase/server";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier, tierMeetsMinimum, type PemabuTier } from "@/lib/security/tier-guard";

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

  const out = await importSleeveStrategy(user.id, portfolioId, sleeveToken);
  if (!out.ok) return { success: false as const, error: out.error };
  return { success: true as const, sleeveId: out.sleeveId };
}
