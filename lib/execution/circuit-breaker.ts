import { getVaultPool } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyExecutionErrorCode } from "@/lib/execution/error-code-taxonomy";

const COOLDOWN_MS = 60 * 60 * 1000;
const HARD_LOCK_THRESHOLD = 3;
const SOFT_PAUSE_THRESHOLD = 5;

export type CircuitOutcomeInput = {
  succeeded: boolean;
  errorCode: string | null;
};

function categoryForInsert(input: CircuitOutcomeInput) {
  if (input.succeeded) return null;
  return classifyExecutionErrorCode(input.errorCode);
}

export async function insertExecutionOutcomeSupabase(
  supabase: SupabaseClient,
  row: {
    portfolioId: string;
    userId: string;
    proposalId: string | null;
    succeeded: boolean;
    errorCode: string | null;
  },
): Promise<void> {
  const failure_category = categoryForInsert(row);
  await supabase.from("execution_errors").insert({
    portfolio_id: row.portfolioId,
    user_id: row.userId,
    proposal_id: row.proposalId,
    succeeded: row.succeeded,
    error_code: row.errorCode,
    failure_category,
  });
}

export async function insertExecutionOutcomeVault(row: {
  portfolioId: string;
  userId: string;
  proposalId: string | null;
  succeeded: boolean;
  errorCode: string | null;
}): Promise<void> {
  const failure_category = categoryForInsert(row);
  await getVaultPool().query(
    `INSERT INTO execution_errors (portfolio_id, user_id, proposal_id, succeeded, error_code, failure_category)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
    [row.portfolioId, row.userId, row.proposalId, row.succeeded, row.errorCode, failure_category],
  );
}

/**
 * After recording an execution outcome row, update streaks, cooldown, and portfolio system_status.
 * - 3 consecutive HARD-class failures → LOCKED (safety).
 * - 5 consecutive SOFT-class failures → PAUSED (network-class aggregate).
 * - Each SOFT failure sets watcher_cooldown_until +1h (Watcher skips portfolio until then).
 * - Success clears streaks; clears PAUSED → ACTIVE; never auto-clears LOCKED.
 */
export async function evaluateCircuitBreakerAfterOutcomeVault(
  portfolioId: string,
  input: CircuitOutcomeInput,
): Promise<void> {
  const pool = getVaultPool();
  if (input.succeeded) {
    await pool.query(
      `UPDATE portfolios SET
         execution_hard_fail_streak = 0,
         execution_soft_fail_streak = 0,
         watcher_cooldown_until = NULL,
         system_status = CASE
           WHEN system_status = 'LOCKED' THEN 'LOCKED'
           WHEN system_status = 'PAUSED' THEN 'ACTIVE'
           ELSE system_status
         END,
         updated_at = now()
       WHERE id = $1::uuid`,
      [portfolioId],
    );
    return;
  }

  const cat = classifyExecutionErrorCode(input.errorCode);
  const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();

  if (cat === "SOFT") {
    await pool.query(
      `UPDATE portfolios SET
         execution_soft_fail_streak = execution_soft_fail_streak + 1,
         execution_hard_fail_streak = 0,
         watcher_cooldown_until = $2::timestamptz,
         system_status = CASE
           WHEN system_status = 'LOCKED' THEN 'LOCKED'
           WHEN execution_soft_fail_streak + 1 >= $3 THEN 'PAUSED'
           ELSE 'ACTIVE'
         END,
         updated_at = now()
       WHERE id = $1::uuid`,
      [portfolioId, cooldownUntil, SOFT_PAUSE_THRESHOLD],
    );
    return;
  }

  await pool.query(
    `UPDATE portfolios SET
       execution_hard_fail_streak = execution_hard_fail_streak + 1,
       execution_soft_fail_streak = 0,
       system_status = CASE
         WHEN system_status = 'LOCKED' THEN 'LOCKED'
         WHEN execution_hard_fail_streak + 1 >= $2 THEN 'LOCKED'
         ELSE 'ACTIVE'
       END,
       updated_at = now()
     WHERE id = $1::uuid`,
    [portfolioId, HARD_LOCK_THRESHOLD],
  );
}

export async function evaluateCircuitBreakerAfterOutcomeSupabase(
  supabase: SupabaseClient,
  portfolioId: string,
  input: CircuitOutcomeInput,
): Promise<void> {
  if (input.succeeded) {
    const { data: cur } = await supabase
      .from("portfolios")
      .select("system_status")
      .eq("id", portfolioId)
      .maybeSingle();
    const st = cur ? (cur as { system_status: string }).system_status : "ACTIVE";
    const nextStatus = st === "LOCKED" ? "LOCKED" : "ACTIVE";
    await supabase
      .from("portfolios")
      .update({
        execution_hard_fail_streak: 0,
        execution_soft_fail_streak: 0,
        watcher_cooldown_until: null,
        system_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", portfolioId);
    return;
  }

  const cat = classifyExecutionErrorCode(input.errorCode);
  const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();

  const { data: row } = await supabase
    .from("portfolios")
    .select("execution_soft_fail_streak, execution_hard_fail_streak, system_status")
    .eq("id", portfolioId)
    .maybeSingle();
  const r = row as {
    execution_soft_fail_streak?: number | null;
    execution_hard_fail_streak?: number | null;
    system_status?: string;
  } | null;

  if (cat === "SOFT") {
    const nextSoft = (r?.execution_soft_fail_streak ?? 0) + 1;
    const locked = r?.system_status === "LOCKED";
    const nextStatus = locked ? "LOCKED" : nextSoft >= SOFT_PAUSE_THRESHOLD ? "PAUSED" : "ACTIVE";
    await supabase
      .from("portfolios")
      .update({
        execution_soft_fail_streak: nextSoft,
        execution_hard_fail_streak: 0,
        watcher_cooldown_until: cooldownUntil,
        system_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", portfolioId);
    return;
  }

  const nextHard = (r?.execution_hard_fail_streak ?? 0) + 1;
  const locked = r?.system_status === "LOCKED";
  const nextStatus = locked || nextHard >= HARD_LOCK_THRESHOLD ? "LOCKED" : "ACTIVE";
  await supabase
    .from("portfolios")
    .update({
      execution_hard_fail_streak: nextHard,
      execution_soft_fail_streak: 0,
      system_status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", portfolioId);
}
