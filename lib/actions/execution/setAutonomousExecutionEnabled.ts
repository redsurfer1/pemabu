"use server";

import { isAutonomous } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";
import { setPortfolioAutonomousExecutionVault, isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

export async function setAutonomousExecutionEnabled(portfolioId: string, enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const keys = await getActiveServiceKeysForUser(user.id);
  if (!isAutonomous(keys)) return { success: false, error: "Autonomous tier required" };

  if (isLocalVaultExecutionPlane()) {
    const ok = await setPortfolioAutonomousExecutionVault(portfolioId, user.id, enabled);
    if (!ok) return { success: false, error: "Portfolio not found" };
    return { success: true };
  }

  const { data: portfolio, error: gErr } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (gErr) return { success: false, error: gErr.message };
  if (!portfolio) return { success: false, error: "Portfolio not found" };

  const { error } = await supabase
    .from("portfolios")
    .update({ autonomous_execution_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", portfolioId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
