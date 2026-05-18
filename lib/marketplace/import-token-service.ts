// lib/marketplace/import-token-service.ts
//
// Manages marketplace import token lifecycle:
//   - Credit tokens from Stripe webhook purchases
//   - Spend tokens atomically on import (via Postgres RPC with advisory lock)
//   - Query balance (delegates to import-gate.ts)
//
// Schema notes (marketplace_import_ledger):
//   Existing columns: id, user_id, strategy_id, service_key, tokens_consumed,
//     price_per_token, total_charged_usd, is_complimentary, imported_at, notes
//   Added by migration [timestamp]_import_token_spend_rpc.sql:
//     direction TEXT NOT NULL DEFAULT 'debit' ('credit' | 'debit')
//     stripe_session_id TEXT (unique on credit rows — idempotency key for Stripe)
//     idempotency_key TEXT (unique index on debit rows — prevents double-spend)
//     amount_usd_cents INTEGER (integer cents; set on credit rows)
//
// All writes use the Postgres spend_import_token() RPC or direct inserts with
// unique-constraint-based idempotency. No application-level transactions are
// needed because the RPC wraps balance check + debit insert atomically.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { getImportTokenBalance } from "./import-gate";

// ── Parameter types ───────────────────────────────────────────────────────────

export interface TokenCreditParams {
  /** Authenticated user UUID */
  userId: string;
  /** Stripe checkout session ID — used as idempotency key for credit rows */
  stripeSessionId: string;
  /** Number of tokens to credit (usually 1 per $4.99 purchase) */
  quantity: number;
  /** Amount paid in integer cents — e.g. 499 for $4.99 */
  amountUsdCents: number;
  /** True for beta/backfill grants; default false */
  isComplimentary?: boolean;
}

export interface TokenSpendParams {
  /** Authenticated user UUID */
  userId: string;
  /** marketplace_strategies.id — nullable for non-catalog imports */
  strategyId: string | null;
  /** Slug or display name for audit context */
  strategySlug: string;
  /** portfolio_id the sleeve is being imported into */
  portfolioId: string;
  /**
   * Idempotency key — prevents double-spend on duplicate requests.
   * Recommended: `${userId}:${strategySlug}:${Math.floor(Date.now() / 60000)}`
   * (same request retried within 60 s gets same key → idempotent)
   */
  idempotencyKey: string;
}

export interface TokenSpendResult {
  success: boolean;
  newBalance: number;
  ledgerRowId: string;
}

// ── Credit ────────────────────────────────────────────────────────────────────

/**
 * Credits import tokens from a Stripe purchase.
 * Idempotent: a duplicate stripe_session_id is silently ignored (23505).
 *
 * Must only be called from the Stripe webhook (service role context).
 */
export async function creditTokensFromStripe(
  params: TokenCreditParams,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("marketplace_import_ledger")
    .insert({
      user_id: params.userId,
      strategy_id: null,
      service_key: "marketplace_import_token",
      direction: "credit",
      tokens_consumed: params.quantity,
      price_per_token:
        params.quantity > 0 ? params.amountUsdCents / 100 / params.quantity : 0,
      total_charged_usd: params.amountUsdCents / 100,
      amount_usd_cents: params.amountUsdCents,
      is_complimentary: params.isComplimentary ?? false,
      stripe_session_id: params.stripeSessionId,
    });

  if (error) {
    if (error.code === "23505") {
      // Unique constraint on stripe_session_id — duplicate webhook delivery, safe to ignore
      console.info(
        "[import-token-service] Duplicate credit ignored for session:",
        params.stripeSessionId,
      );
      return;
    }
    throw new Error(`Failed to credit import tokens: ${error.message}`);
  }
}

// ── Spend ─────────────────────────────────────────────────────────────────────

/**
 * Atomically spends one import token via the spend_import_token() Postgres RPC.
 *
 * The RPC:
 *   1. Acquires a per-user advisory lock to serialize concurrent requests
 *   2. Recalculates the balance (no TOCTOU gap)
 *   3. Raises P0001 if balance ≤ 0
 *   4. Inserts the debit row with idempotency_key
 *   5. Returns { success, newBalance, ledgerRowId }
 *
 * @throws Error with message "INSUFFICIENT_TOKENS" if balance is zero
 */
export async function spendImportToken(
  params: TokenSpendParams,
): Promise<TokenSpendResult> {
  const { data, error } = await supabaseAdmin.rpc("spend_import_token", {
    p_user_id: params.userId,
    p_strategy_id: params.strategyId,
    p_strategy_slug: params.strategySlug,
    p_portfolio_id: params.portfolioId,
    p_idempotency_key: params.idempotencyKey,
  });

  if (error) {
    // P0001 is raised by the RPC when balance is 0
    if (error.code === "P0001" || error.message?.includes("INSUFFICIENT_TOKENS")) {
      throw new Error("INSUFFICIENT_TOKENS");
    }
    // 23505 = duplicate idempotency key — import already succeeded for this key
    if (error.code === "23505") {
      const existing = await getExistingSpend(params.idempotencyKey, params.userId);
      if (existing) return existing;
    }
    throw new Error(`Failed to spend import token: ${error.message}`);
  }

  return data as TokenSpendResult;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Retrieves the result of a previously completed spend (idempotency hit).
 * Returns null if the row cannot be found (should not happen after 23505).
 */
async function getExistingSpend(
  idempotencyKey: string,
  userId: string,
): Promise<TokenSpendResult | null> {
  const { data } = await supabaseAdmin
    .from("marketplace_import_ledger")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .eq("user_id", userId)
    .eq("direction", "debit")
    .maybeSingle();

  if (!data) return null;

  const balance = await getImportTokenBalance(userId);
  return {
    success: true,
    newBalance: balance,
    ledgerRowId: (data as { id: string }).id,
  };
}
