/**
 * Raw Postgres access for execution tables when `USE_LOCAL_VAULT=true`
 * (same schema as Supabase migrations applied via `npm run vault:sync`).
 */
import { getVaultPool } from "@/lib/db";
import { d } from "@/lib/portfolio/precision-money";
import type { HoldingAuditInsert } from "@/lib/portfolio/holding-audit";
import type { ExecutionControlRow, GuardrailContext } from "@/lib/execution/guardrails";
import type { ExchangeName } from "@/lib/execution/types";

export function isLocalVaultExecutionPlane(): boolean {
  return process.env.USE_LOCAL_VAULT === "true";
}

function pool() {
  return getVaultPool();
}

export async function insertHoldingAuditVault(row: HoldingAuditInsert): Promise<void> {
  await pool().query(
    `INSERT INTO holding_audit_log (
       user_id, portfolio_id, sleeve_id, holding_id, event_type, ticker,
       quantity_before, quantity_after, cost_basis_before, cost_basis_after, notes
     ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
    [
      row.userId,
      row.portfolioId,
      row.sleeveId,
      row.holdingId,
      row.eventType,
      row.ticker,
      row.quantityBefore,
      row.quantityAfter,
      row.costBasisBefore,
      row.costBasisAfter,
      JSON.stringify(row.notes ?? {}),
    ],
  );
}

export async function ensureExecutionControlRowVault(userId: string): Promise<ExecutionControlRow> {
  const { rows } = await pool().query<Record<string, unknown>>(
    `SELECT * FROM execution_control WHERE user_id = $1::uuid`,
    [userId],
  );
  if (rows[0]) {
    const r = rows[0];
    return {
      kill_switch_enabled: Boolean(r.kill_switch_enabled),
      circuit_locked: Boolean(r.circuit_locked),
      consecutive_api_failures: Number(r.consecutive_api_failures ?? 0),
      last_error_codes: (r.last_error_codes as string[] | null) ?? [],
      max_trade_usd: r.max_trade_usd != null ? Number(r.max_trade_usd) : null,
      max_trade_pct_portfolio: r.max_trade_pct_portfolio != null ? Number(r.max_trade_pct_portfolio) : null,
      daily_volume_limit_usd: r.daily_volume_limit_usd != null ? Number(r.daily_volume_limit_usd) : null,
    };
  }
  const ins = await pool().query<Record<string, unknown>>(
    `INSERT INTO execution_control (
       user_id, kill_switch_enabled, circuit_locked, consecutive_api_failures, last_error_codes
     ) VALUES ($1::uuid, true, false, 0, '{}')
     RETURNING *`,
    [userId],
  );
  const r = ins.rows[0]!;
  return {
    kill_switch_enabled: Boolean(r.kill_switch_enabled),
    circuit_locked: Boolean(r.circuit_locked),
    consecutive_api_failures: Number(r.consecutive_api_failures ?? 0),
    last_error_codes: (r.last_error_codes as string[] | null) ?? [],
    max_trade_usd: r.max_trade_usd != null ? Number(r.max_trade_usd) : null,
    max_trade_pct_portfolio: r.max_trade_pct_portfolio != null ? Number(r.max_trade_pct_portfolio) : null,
    daily_volume_limit_usd: r.daily_volume_limit_usd != null ? Number(r.daily_volume_limit_usd) : null,
  };
}

export async function portfolioNavUsdVault(portfolioId: string): Promise<ReturnType<typeof d>> {
  const { rows } = await pool().query<{ sum: string | null }>(
    `SELECT COALESCE(SUM(sh.qty * sh.price_seed), 0)::text AS sum
     FROM sleeve_holdings sh
     JOIN sleeves sl ON sl.id = sh.sleeve_id
     WHERE sl.portfolio_id = $1::uuid AND sl.is_active = true`,
    [portfolioId],
  );
  return d(rows[0]?.sum ?? "0");
}

export async function rolling24hNotionalUsdVault(userId: string): Promise<ReturnType<typeof d>> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { rows } = await pool().query<{ sum: string | null }>(
    `SELECT COALESCE(SUM(notional_usd), 0)::text AS sum
     FROM daily_execution_logs
     WHERE user_id = $1::uuid AND created_at >= $2::timestamptz`,
    [userId, since],
  );
  return d(rows[0]?.sum ?? "0");
}

export async function buildGuardrailContextVault(
  userId: string,
  portfolioId: string,
  tradeNotional: ReturnType<typeof d>,
): Promise<GuardrailContext> {
  const control = await ensureExecutionControlRowVault(userId);
  const portfolioNav = await portfolioNavUsdVault(portfolioId);
  const rolling24hNotional = await rolling24hNotionalUsdVault(userId);
  return { control, portfolioNav, tradeNotional, rolling24hNotional };
}

export async function fetchTradeProposalVault(
  userId: string,
  proposalId: string,
): Promise<Record<string, unknown> | null> {
  const { rows } = await pool().query<Record<string, unknown>>(
    `SELECT * FROM trade_proposals WHERE id = $1::uuid AND user_id = $2::uuid`,
    [proposalId, userId],
  );
  return rows[0] ?? null;
}

export async function updateTradeProposalStatusVault(proposalId: string, status: string): Promise<void> {
  await pool().query(
    `UPDATE trade_proposals SET status = $2, updated_at = now() WHERE id = $1::uuid`,
    [proposalId, status],
  );
}

export async function fetchSleeveHoldingQtyPriceVault(holdingId: string): Promise<{ qty: string; price_seed: string } | null> {
  const { rows } = await pool().query<{ qty: string; price_seed: string }>(
    `SELECT qty::text, price_seed::text FROM sleeve_holdings WHERE id = $1::uuid`,
    [holdingId],
  );
  return rows[0] ?? null;
}

export type ExchangeCredentialVaultRow = {
  encrypted_api_key: string;
  encrypted_secret: string;
  iv: string;
  auth_tag: string;
  secret_iv: string | null;
  secret_auth_tag: string | null;
};

export async function fetchExchangeCredentialsVault(
  userId: string,
  exchangeName: ExchangeName,
): Promise<ExchangeCredentialVaultRow | null> {
  const { rows } = await pool().query<ExchangeCredentialVaultRow>(
    `SELECT encrypted_api_key, encrypted_secret, iv, auth_tag, secret_iv, secret_auth_tag
     FROM exchange_credentials
     WHERE user_id = $1::uuid AND exchange_name = $2`,
    [userId, exchangeName],
  );
  return rows[0] ?? null;
}

export async function updateExecutionControlVault(
  userId: string,
  fields: Partial<{
    consecutive_api_failures: number;
    last_error_codes: string[];
    circuit_locked: boolean;
    kill_switch_enabled: boolean;
  }>,
): Promise<void> {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined) as [
    keyof typeof fields,
    string | number | boolean | string[],
  ][];
  if (entries.length === 0) {
    await pool().query(`UPDATE execution_control SET updated_at = now() WHERE user_id = $1::uuid`, [userId]);
    return;
  }
  const sets: string[] = ["updated_at = now()"];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of entries) {
    if (k === "last_error_codes") {
      sets.push(`last_error_codes = $${i++}::text[]`);
      vals.push(v);
    } else {
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
  }
  vals.push(userId);
  await pool().query(
    `UPDATE execution_control SET ${sets.join(", ")} WHERE user_id = $${i}::uuid`,
    vals,
  );
}

export async function insertDailyExecutionLogVault(input: {
  userId: string;
  notionalUsd: number;
  proposalId: string;
  exchangeName: ExchangeName;
  result: string;
  errorCode: string | null;
}): Promise<void> {
  await pool().query(
    `INSERT INTO daily_execution_logs (user_id, notional_usd, proposal_id, exchange_name, result, error_code)
     VALUES ($1::uuid, $2::numeric, $3::uuid, $4, $5, $6)`,
    [input.userId, input.notionalUsd, input.proposalId, input.exchangeName, input.result, input.errorCode],
  );
}

export async function upsertExchangeCredentialsVault(row: {
  userId: string;
  exchange: ExchangeName;
  encrypted_api_key: string;
  iv: string;
  auth_tag: string;
  encrypted_secret: string;
  secret_iv: string;
  secret_auth_tag: string;
}): Promise<void> {
  await pool().query(
    `INSERT INTO exchange_credentials (
       user_id, exchange_name, encrypted_api_key, encrypted_secret, iv, auth_tag, secret_iv, secret_auth_tag, updated_at
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (user_id, exchange_name) DO UPDATE SET
       encrypted_api_key = EXCLUDED.encrypted_api_key,
       encrypted_secret = EXCLUDED.encrypted_secret,
       iv = EXCLUDED.iv,
       auth_tag = EXCLUDED.auth_tag,
       secret_iv = EXCLUDED.secret_iv,
       secret_auth_tag = EXCLUDED.secret_auth_tag,
       updated_at = now()`,
    [
      row.userId,
      row.exchange,
      row.encrypted_api_key,
      row.encrypted_secret,
      row.iv,
      row.auth_tag,
      row.secret_iv,
      row.secret_auth_tag,
    ],
  );
}

export async function listPendingTradeProposalsVault(userId: string): Promise<
  Array<{
    id: string;
    portfolio_id: string;
    sleeve_id: string;
    holding_id: string | null;
    ticker: string;
    quantity: string;
  }>
> {
  const { rows } = await pool().query(
    `SELECT id::text, portfolio_id::text, sleeve_id::text, holding_id::text, ticker, quantity::text
     FROM trade_proposals WHERE user_id = $1::uuid AND status = 'PENDING'`,
    [userId],
  );
  return rows as Array<{
    id: string;
    portfolio_id: string;
    sleeve_id: string;
    holding_id: string | null;
    ticker: string;
    quantity: string;
  }>;
}

export async function setPortfolioAutonomousExecutionVault(
  portfolioId: string,
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  const { rowCount } = await pool().query(
    `UPDATE portfolios
     SET autonomous_execution_enabled = $3, updated_at = now()
     WHERE id = $1::uuid AND user_id = $2::uuid`,
    [portfolioId, userId, enabled],
  );
  return (rowCount ?? 0) > 0;
}

export async function listTradeProposalsForUserVault(
  userId: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const { rows } = await pool().query(
    `SELECT id::text, portfolio_id::text, sleeve_id::text, holding_id::text, ticker, action, quantity::text,
            status, exchange_name, drift_pct::text, created_at::text, updated_at::text
     FROM trade_proposals
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
}
