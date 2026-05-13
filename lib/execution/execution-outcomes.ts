import { getVaultPool } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  insertExecutionOutcomeSupabase,
  insertExecutionOutcomeVault,
  evaluateCircuitBreakerAfterOutcomeVault,
  evaluateCircuitBreakerAfterOutcomeSupabase,
} from "@/lib/execution/circuit-breaker";

export async function fetchPortfolioSystemStatusSupabase(
  supabase: SupabaseClient,
  portfolioId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("portfolios")
    .select("system_status")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? String((data as { system_status: string }).system_status) : null;
}

export async function fetchPortfolioSystemStatusVault(portfolioId: string, userId: string): Promise<string | null> {
  const { rows } = await getVaultPool().query<{ system_status: string }>(
    `SELECT system_status FROM portfolios WHERE id = $1::uuid AND user_id = $2::uuid`,
    [portfolioId, userId],
  );
  return rows[0]?.system_status ?? null;
}

export async function resetPortfolioExecutionLockVault(portfolioId: string, userId: string): Promise<boolean> {
  const { rowCount } = await getVaultPool().query(
    `UPDATE portfolios SET
       system_status = 'ACTIVE',
       execution_hard_fail_streak = 0,
       execution_soft_fail_streak = 0,
       watcher_cooldown_until = NULL,
       updated_at = now()
     WHERE id = $1::uuid AND user_id = $2::uuid`,
    [portfolioId, userId],
  );
  return (rowCount ?? 0) > 0;
}

export async function resetPortfolioExecutionLockSupabase(
  supabase: SupabaseClient,
  portfolioId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("portfolios")
    .update({
      system_status: "ACTIVE",
      execution_hard_fail_streak: 0,
      execution_soft_fail_streak: 0,
      watcher_cooldown_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}
