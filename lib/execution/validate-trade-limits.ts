import { d } from "@/lib/portfolio/precision-money";
import type { Decimal } from "decimal.js";
import type { ExecutionControlRow } from "@/lib/execution/guardrails";

/** Shape used by approve flow after notional is computed (Decimal strings for JSON safety). */
export interface TradeLimitProposal {
  portfolioId: string;
  userId: string;
  /** USD notional for this execution (quantity × mark). */
  tradeNotionalUsd: Decimal;
}

export interface TradeLimitInputs {
  proposal: TradeLimitProposal;
  control: ExecutionControlRow;
  portfolioNavUsd: Decimal;
  /** Cumulative executed notional in the rolling 24h window (UTC). */
  rolling24hNotionalUsd: Decimal;
}

export type TradeLimitRejectCode =
  | "MAX_TRADE_USD"
  | "MAX_TRADE_PCT_NAV"
  | "DAILY_VOLUME_LIMIT"
  | "KILL_SWITCH_OFF"
  | "CIRCUIT_LOCKED"
  | "PORTFOLIO_EXECUTION_LOCKED";

/**
 * Single gate for max trade (USD and % of portfolio NAV) and rolling 24h volume vs limit.
 * Kill switch / circuit / portfolio lock are checked separately via `assertExecutionPreconditions`.
 */
export function validateTradeAgainstLimits(input: TradeLimitInputs): { ok: true } | { ok: false; code: TradeLimitRejectCode } {
  const { proposal, control, portfolioNavUsd, rolling24hNotionalUsd } = input;
  const notional = proposal.tradeNotionalUsd;

  if (control.max_trade_usd != null && control.max_trade_usd !== undefined) {
    if (notional.gt(d(String(control.max_trade_usd)))) return { ok: false, code: "MAX_TRADE_USD" };
  }
  if (control.max_trade_pct_portfolio != null && control.max_trade_pct_portfolio !== undefined && !portfolioNavUsd.isZero()) {
    const pct = notional.div(portfolioNavUsd).mul(100);
    if (pct.gt(d(String(control.max_trade_pct_portfolio)))) return { ok: false, code: "MAX_TRADE_PCT_NAV" };
  }

  if (control.daily_volume_limit_usd != null && control.daily_volume_limit_usd !== undefined) {
    const limit = d(String(control.daily_volume_limit_usd));
    if (rolling24hNotionalUsd.plus(notional).gt(limit)) return { ok: false, code: "DAILY_VOLUME_LIMIT" };
  }

  return { ok: true };
}

export function assertPortfolioExecutionUnlocked(systemStatus: string | null | undefined): TradeLimitRejectCode | null {
  if (systemStatus === "LOCKED" || systemStatus === "PAUSED") return "PORTFOLIO_EXECUTION_LOCKED";
  return null;
}
