"use server";

import { isAutonomous } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";
import {
  resetPortfolioExecutionLockSupabase,
  resetPortfolioExecutionLockVault,
} from "@/lib/execution/execution-outcomes";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

/** Manual operator reset after `system_status = LOCKED` (three execution failures). */
export async function resetPortfolioExecutionLock(portfolioId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthenticated" };

  const keys = await getActiveServiceKeysForUser(user.id);
  if (!isAutonomous(keys)) return { success: false, error: "Autonomous tier required" };

  const ok = isLocalVaultExecutionPlane()
    ? await resetPortfolioExecutionLockVault(portfolioId, user.id)
    : await resetPortfolioExecutionLockSupabase(supabase, portfolioId, user.id);

  if (!ok) return { success: false, error: "Portfolio not found" };
  return { success: true };
}
