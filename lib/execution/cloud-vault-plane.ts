/**
 * Supabase-based equivalents of vault-execution-plane operations.
 * Used when USE_LOCAL_VAULT is false (cloud-hosted vault).
 * All operations go through supabaseAdmin (service role) RPCs
 * defined in migration 20260705000001.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { d } from "@/lib/portfolio/precision-money";
import type { HoldingAuditInsert } from "@/lib/portfolio/holding-audit";
import type { ExecutionControlRow, GuardrailContext } from "@/lib/execution/guardrails";
import type { ExchangeName } from "@/lib/execution/types";

async function callRpc<T>(rpcName: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(rpcName, params as Record<string, unknown>);
  if (error) throw new Error(`${rpcName} failed: ${error.message}`);
  return data as T;
}

export async function insertHoldingAuditCloud(row: HoldingAuditInsert): Promise<void> {
  await callRpc("cloud_insert_holding_audit", {
    p_user_id: row.userId,
    p_portfolio_id: row.portfolioId,
    p_sleeve_id: row.sleeveId,
    p_holding_id: row.holdingId,
    p_event_type: row.eventType,
    p_ticker: row.ticker,
    p_quantity_before: row.quantityBefore,
    p_quantity_after: row.quantityAfter,
    p_cost_basis_before: row.costBasisBefore,
    p_cost_basis_after: row.costBasisAfter,
    p_notes: JSON.stringify(row.notes ?? {}),
  });
}

export async function ensureExecutionControlRowCloud(userId: string): Promise<ExecutionControlRow> {
  const data = await callRpc<Record<string, unknown>>("cloud_ensure_execution_control", { p_user_id: userId });
  return {
    kill_switch_enabled: Boolean(data.kill_switch_enabled),
    circuit_locked: Boolean(data.circuit_locked),
    consecutive_api_failures: Number(data.consecutive_api_failures ?? 0),
    last_error_codes: (data.last_error_codes as string[] | null) ?? [],
    max_trade_usd: data.max_trade_usd != null ? Number(data.max_trade_usd) : null,
    max_trade_pct_portfolio: data.max_trade_pct_portfolio != null ? Number(data.max_trade_pct_portfolio) : null,
    daily_volume_limit_usd: data.daily_volume_limit_usd != null ? Number(data.daily_volume_limit_usd) : null,
  };
}

export async function portfolioNavUsdCloud(portfolioId: string): Promise<ReturnType<typeof d>> {
  const value = await callRpc<number>("cloud_portfolio_nav_usd", { p_portfolio_id: portfolioId });
  return d(String(value ?? 0));
}

export async function rolling24hNotionalUsdCloud(userId: string): Promise<ReturnType<typeof d>> {
  const value = await callRpc<number>("cloud_rolling_24h_notional", { p_user_id: userId });
  return d(String(value ?? 0));
}

export async function buildGuardrailContextCloud(
  userId: string,
  portfolioId: string,
  tradeNotional: ReturnType<typeof d>,
): Promise<GuardrailContext> {
  const [control, portfolioNav, rolling24hNotional] = await Promise.all([
    ensureExecutionControlRowCloud(userId),
    portfolioNavUsdCloud(portfolioId),
    rolling24hNotionalUsdCloud(userId),
  ]);
  return { control, portfolioNav, tradeNotional, rolling24hNotional };
}

export async function fetchTradeProposalCloud(
  userId: string,
  proposalId: string,
): Promise<Record<string, unknown> | null> {
  return callRpc<Record<string, unknown> | null>("cloud_fetch_trade_proposal", {
    p_user_id: userId,
    p_proposal_id: proposalId,
  });
}

export async function updateTradeProposalStatusCloud(proposalId: string, status: string): Promise<void> {
  await callRpc("cloud_update_trade_proposal_status", { p_proposal_id: proposalId, p_status: status });
}

export async function fetchSleeveHoldingQtyPriceCloud(
  holdingId: string,
): Promise<{ qty: string; price_seed: string } | null> {
  const data = await callRpc<Record<string, string> | null>("cloud_fetch_sleeve_holding_qty_price", {
    p_holding_id: holdingId,
  });
  return data ? { qty: data.qty, price_seed: data.price_seed } : null;
}

export type ExchangeCredentialCloudRow = {
  encrypted_api_key: string;
  encrypted_secret: string;
  iv: string;
  auth_tag: string;
  secret_iv: string | null;
  secret_auth_tag: string | null;
};

export async function fetchExchangeCredentialsCloud(
  userId: string,
  exchangeName: ExchangeName,
): Promise<ExchangeCredentialCloudRow | null> {
  const data = await callRpc<Record<string, unknown> | null>("cloud_fetch_exchange_credentials", {
    p_user_id: userId,
    p_exchange_name: exchangeName,
  });
  if (!data) return null;
  return {
    encrypted_api_key: data.encrypted_api_key as string,
    encrypted_secret: data.encrypted_secret as string,
    iv: data.iv as string,
    auth_tag: data.auth_tag as string,
    secret_iv: (data.secret_iv as string | null) ?? null,
    secret_auth_tag: (data.secret_auth_tag as string | null) ?? null,
  };
}

export async function upsertExchangeCredentialsCloud(row: {
  userId: string;
  exchange: ExchangeName;
  encrypted_api_key: string;
  iv: string;
  auth_tag: string;
  encrypted_secret: string;
  secret_iv: string;
  secret_auth_tag: string;
}): Promise<void> {
  await callRpc("cloud_upsert_exchange_credentials", {
    p_user_id: row.userId,
    p_exchange_name: row.exchange,
    p_encrypted_api_key: row.encrypted_api_key,
    p_iv: row.iv,
    p_auth_tag: row.auth_tag,
    p_encrypted_secret: row.encrypted_secret,
    p_secret_iv: row.secret_iv,
    p_secret_auth_tag: row.secret_auth_tag,
  });
}

export async function deleteExchangeCredentialsCloud(
  userId: string,
  exchangeName: ExchangeName,
): Promise<void> {
  await callRpc("cloud_delete_exchange_credentials", {
    p_user_id: userId,
    p_exchange_name: exchangeName,
  });
}

export async function updateExecutionControlCloud(
  userId: string,
  fields: Partial<{
    consecutive_api_failures: number;
    last_error_codes: string[];
    circuit_locked: boolean;
    kill_switch_enabled: boolean;
  }>,
): Promise<void> {
  await callRpc("cloud_update_execution_control", {
    p_user_id: userId,
    p_fields: JSON.stringify(fields),
  });
}

export async function insertDailyExecutionLogCloud(input: {
  userId: string;
  notionalUsd: number;
  proposalId: string;
  exchangeName: ExchangeName;
  result: string;
  errorCode: string | null;
}): Promise<void> {
  await callRpc("cloud_insert_daily_execution_log", {
    p_user_id: input.userId,
    p_notional_usd: input.notionalUsd,
    p_proposal_id: input.proposalId,
    p_exchange_name: input.exchangeName,
    p_result: input.result,
    p_error_code: input.errorCode,
  });
}

export async function setPortfolioAutonomousExecutionCloud(
  portfolioId: string,
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  return callRpc<boolean>("cloud_set_autonomous_execution", {
    p_portfolio_id: portfolioId,
    p_user_id: userId,
    p_enabled: enabled,
  });
}

export async function listPendingTradeProposalsCloud(userId: string): Promise<
  Array<{ id: string; portfolio_id: string; sleeve_id: string; holding_id: string | null; ticker: string; quantity: string }>
> {
  return callRpc<
    Array<{ id: string; portfolio_id: string; sleeve_id: string; holding_id: string | null; ticker: string; quantity: string }>
  >("cloud_list_pending_trade_proposals", { p_user_id: userId });
}

export async function listTradeProposalsForUserCloud(
  userId: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  return callRpc<Array<Record<string, unknown>>>("cloud_list_trade_proposals", {
    p_user_id: userId,
    p_limit: limit,
  });
}
