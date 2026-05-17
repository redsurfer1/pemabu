// lib/marketplace/import-gate.ts
//
// Single source of truth for import entitlement checks.
// Replaces direct calls to assertMarketplaceImportUnlock in both the API
// route and the server action.
//
// Feature flag: MARKETPLACE_USE_IMPORT_LEDGER controls which path runs.
//   false (default) — delegates to assertMarketplaceImportUnlock (existing
//                     per-blueprint unlock behavior, unchanged).
//   true            — checks token balance in marketplace_import_ledger.
//                     Do NOT enable until the ledger backfill migration
//                     (backfill_existing_unlocks_to_ledger) has been applied.
//
// NOTE: The direction / stripe_session_id / idempotency_key columns used by
// getImportTokenBalance are added to marketplace_import_ledger by migration
// [timestamp]_import_token_spend_rpc.sql. This module is safe to deploy
// before that migration runs because the ledger path is behind the feature
// flag and will not execute until MARKETPLACE_USE_IMPORT_LEDGER=true.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertMarketplaceImportUnlock } from "./assert-import-unlock";

// ── Error class ───────────────────────────────────────────────────────────────

export class ImportEntitlementError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INSUFFICIENT_TOKENS"
      | "NO_UNLOCK"
      | "ALREADY_IMPORTED"
      | "RATE_LIMITED",
  ) {
    super(message);
    this.name = "ImportEntitlementError";
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Verifies the user has entitlement to import a sleeve strategy.
 *
 * When MARKETPLACE_USE_IMPORT_LEDGER=false (default):
 *   Delegates to assertMarketplaceImportUnlock — existing per-blueprint
 *   unlock behavior is completely unchanged.
 *
 * When MARKETPLACE_USE_IMPORT_LEDGER=true:
 *   Checks token balance in marketplace_import_ledger.
 *   Does NOT spend the token — call spendImportToken() in
 *   import-token-service.ts after the import succeeds.
 *
 * @param userId      Authenticated user UUID
 * @param sleeveToken Raw Base64URL sleeve token (passed through to the
 *                    existing gate; also used to derive strategy_id for
 *                    ledger debit rows via the token service)
 * @throws ImportEntitlementError if entitlement check fails
 */
export async function enforceImportEntitlement(
  userId: string,
  sleeveToken: string,
): Promise<void> {
  const useLedger = process.env.MARKETPLACE_USE_IMPORT_LEDGER === "true";

  if (!useLedger) {
    // Existing behavior — this path must not change
    const gate = await assertMarketplaceImportUnlock(userId, sleeveToken);
    if (!gate.ok) {
      throw new ImportEntitlementError(gate.message, "NO_UNLOCK");
    }
    return;
  }

  // Ledger path — check balance only, do not spend here
  const balance = await getImportTokenBalance(userId);
  if (balance <= 0) {
    throw new ImportEntitlementError(
      "No import tokens remaining. Purchase tokens to continue.",
      "INSUFFICIENT_TOKENS",
    );
  }
}

/**
 * Returns the current import token balance for a user.
 * Balance = SUM(tokens_consumed WHERE direction='credit')
 *         - SUM(tokens_consumed WHERE direction='debit')
 *
 * Requires the direction column added by migration
 * [timestamp]_import_token_spend_rpc.sql to be present.
 */
export async function getImportTokenBalance(userId: string): Promise<number> {
  // Credit count — Stripe purchases and complimentary grants
  const { data: creditRows, error: creditsError } = await supabaseAdmin
    .from("marketplace_import_ledger")
    .select("tokens_consumed")
    .eq("user_id", userId)
    .eq("direction", "credit");

  if (creditsError) {
    throw new Error(`Token balance check failed (credits): ${creditsError.message}`);
  }

  // Debit count — import spends
  const { data: debitRows, error: debitsError } = await supabaseAdmin
    .from("marketplace_import_ledger")
    .select("tokens_consumed")
    .eq("user_id", userId)
    .eq("direction", "debit");

  if (debitsError) {
    throw new Error(`Token balance check failed (debits): ${debitsError.message}`);
  }

  const credits = (creditRows ?? []).reduce(
    (sum: number, r: { tokens_consumed: number }) => sum + (r.tokens_consumed ?? 0),
    0,
  );
  const debits = (debitRows ?? []).reduce(
    (sum: number, r: { tokens_consumed: number }) => sum + (r.tokens_consumed ?? 0),
    0,
  );

  return credits - debits;
}
