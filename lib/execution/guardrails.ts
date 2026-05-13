import { d } from "@/lib/portfolio/precision-money";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExecutionControlRow {
  kill_switch_enabled: boolean;
  circuit_locked: boolean;
  consecutive_api_failures: number;
  last_error_codes: string[] | null;
  max_trade_usd: number | null;
  max_trade_pct_portfolio: number | null;
  daily_volume_limit_usd: number | null;
}

export async function ensureExecutionControlRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<ExecutionControlRow> {
  const { data: existing } = await supabase
    .from("execution_control")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as ExecutionControlRow;

  const defaults = {
    user_id: userId,
    kill_switch_enabled: true,
    circuit_locked: false,
    consecutive_api_failures: 0,
    last_error_codes: [] as string[],
    max_trade_usd: null as number | null,
    max_trade_pct_portfolio: null as number | null,
    daily_volume_limit_usd: null as number | null,
  };
  const { data, error } = await supabase.from("execution_control").insert(defaults).select("*").single();
  if (error) throw new Error(error.message);
  return data as ExecutionControlRow;
}

export async function portfolioNavUsd(
  supabase: SupabaseClient,
  portfolioId: string,
): Promise<ReturnType<typeof d>> {
  const { data: sleeves } = await supabase
    .from("sleeves")
    .select("id")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true);
  const ids = (sleeves ?? []).map((s: { id: string }) => s.id);
  if (ids.length === 0) return d(0);
  const { data: rows } = await supabase.from("sleeve_holdings").select("qty, price_seed").in("sleeve_id", ids);
  let sum = d(0);
  for (const r of rows ?? []) {
    const row = r as { qty: string | number; price_seed: string | number };
    sum = sum.plus(d(String(row.qty)).mul(d(String(row.price_seed))));
  }
  return sum;
}

/** Sum of notionals from successful executions in the rolling prior 24 hours (UTC). */
export async function rolling24hNotionalUsd(supabase: SupabaseClient, userId: string): Promise<ReturnType<typeof d>> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabase
    .from("daily_execution_logs")
    .select("notional_usd")
    .eq("user_id", userId)
    .gte("created_at", since);
  let sum = d(0);
  for (const r of rows ?? []) {
    sum = sum.plus(d(String((r as { notional_usd: number }).notional_usd)));
  }
  return sum;
}

export interface GuardrailContext {
  control: ExecutionControlRow;
  portfolioNav: ReturnType<typeof d>;
  tradeNotional: ReturnType<typeof d>;
  /** Cumulative notional from `daily_execution_logs` in the last 24h (UTC `created_at`). */
  rolling24hNotional: ReturnType<typeof d>;
}

export async function buildGuardrailContext(
  supabase: SupabaseClient,
  userId: string,
  portfolioId: string,
  tradeNotional: ReturnType<typeof d>,
): Promise<GuardrailContext> {
  const control = await ensureExecutionControlRow(supabase, userId);
  const portfolioNav = await portfolioNavUsd(supabase, portfolioId);
  const rolling24hNotional = await rolling24hNotionalUsd(supabase, userId);
  return { control, portfolioNav, tradeNotional, rolling24hNotional };
}

export function assertKillSwitch(control: ExecutionControlRow): string | null {
  if (!control.kill_switch_enabled) return "KILL_SWITCH_OFF";
  if (control.circuit_locked) return "CIRCUIT_LOCKED";
  return null;
}

export function assertMaxTradeSize(control: ExecutionControlRow, nav: ReturnType<typeof d>, notional: ReturnType<typeof d>): string | null {
  if (control.max_trade_usd !== null && control.max_trade_usd !== undefined) {
    if (notional.gt(d(String(control.max_trade_usd)))) return "MAX_TRADE_USD";
  }
  if (control.max_trade_pct_portfolio !== null && control.max_trade_pct_portfolio !== undefined && !nav.isZero()) {
    const pct = notional.div(nav).mul(100);
    if (pct.gt(d(String(control.max_trade_pct_portfolio)))) return "MAX_TRADE_PCT_NAV";
  }
  return null;
}

/** @deprecated Prefer `validateTradeAgainstLimits` rolling 24h check. */
export function assertDailyLimit(
  control: ExecutionControlRow,
  rolling24hSoFar: ReturnType<typeof d>,
  notional: ReturnType<typeof d>,
): string | null {
  if (control.daily_volume_limit_usd === null || control.daily_volume_limit_usd === undefined) return null;
  const limit = d(String(control.daily_volume_limit_usd));
  if (rolling24hSoFar.plus(notional).gt(limit)) return "DAILY_VOLUME_LIMIT";
  return null;
}

const CIRCUIT_ERROR = "BALANCE_INSUFFICIENT";

export function shouldCircuitLockFromErrorCodes(codes: string[]): boolean {
  if (codes.length < 3) return false;
  const last3 = codes.slice(-3);
  return last3.every((c) => c === CIRCUIT_ERROR);
}

export function appendErrorCode(existing: string[] | null | undefined, code: string): string[] {
  const arr = [...(existing ?? [])];
  arr.push(code);
  return arr.slice(-10);
}
