"use server";

import { isAutonomous } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";
import {
  VAULT_REQUIRED_CODE,
  VAULT_REQUIRED_MESSAGE,
} from "@/lib/execution/sovereign-messages";
import { setPortfolioAutonomousExecutionVault, isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

export async function setAutonomousExecutionEnabled(portfolioId: string, enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const keys = await getActiveServiceKeysForUser(user.id);
  if (!isAutonomous(keys)) return { success: false, error: "Autonomous tier required" };

  if (!isLocalVaultExecutionPlane()) {
    return {
      success: false,
      error: VAULT_REQUIRED_MESSAGE,
      code: VAULT_REQUIRED_CODE,
    };
  }

  const ok = await setPortfolioAutonomousExecutionVault(portfolioId, user.id, enabled);
  if (!ok) return { success: false, error: "Portfolio not found" };
  return { success: true };
}
