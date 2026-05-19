import { parseRowStatus, type RowStatus } from "@/lib/portfolio/fiat-watchlist";

export interface ComputedRow {
  id: string;
  portfolio_id: string;
  rowStatus: RowStatus;
  symbol: string;
  name: string;
  quantity: number;
  expense_ratio: number | null;
  dividend_dollars: number | null;
  target_parity_weight: number | null;
  price_current: number | null;
  price_24h_basis: number | null;
  price_7d_basis: number | null;
  basis_price_3mo: number | null;
  basis_price_6mo: number | null;
  basis_price_1yr: number | null;
  basis_price_3yr: number | null;
  basis_price_5yr: number | null;
  volatility_3mo: number | null;
  rsi_14: number | null;
  last_market_refresh: string | null;
  market_value: number | null;
  current_weight: number | null;
  div_apy: number | null;
  change_24h: number | null;
  change_7d: number | null;
  return_3mo: number | null;
  return_6mo: number | null;
  return_1yr: number | null;
  return_3yr: number | null;
  return_5yr: number | null;
  return_avg: number | null;
  return_weighted_avg: number | null;
  volatility_abs: number | null;
  volatility_signed: number | null;
  sub_rank_current: number | null;
  sub_rank_expense: number | null;
  sub_rank_weighted_ret: number | null;
  sub_rank_div_apy: number | null;
  sub_rank_volatility: number | null;
  sub_rank_thirteen_f: number | null;
  sub_rank_macro_intelligence: number | null;
  sub_rank_governance_layer: number | null;
  sub_rank_political_tracker: number | null;
  sub_rank_token_quality: number | null;
  composite_score: number | null;
  rank_overall: number | null;
  alert_primary: string | null;
  alert_secondary: string | null;
  target_sleeve_pct: number | null;
  parity_dollars: number | null;
  parity_change_dollars: number | null;
  shares_delta: number | null;
}

export type RealtimeConnectionStatus = "connecting" | "connected" | "disconnected";

export function pickNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mapHoldingToComputedRow(row: Record<string, unknown>): ComputedRow {
  const symbol = String(row.ticker ?? row.symbol ?? "");
  const quantity = Number(row.quantity ?? 0);
  const isCash = symbol === "CASH" || row.asset_class === "cash";
  const price_current =
    pickNum(row.price_current) ?? pickNum(row.current_price) ?? (isCash ? 1 : null);
  const market_value =
    pickNum(row.market_value) ??
    (price_current != null && quantity > 0 ? quantity * price_current : null);
  const targetWt = pickNum(row.target_parity_weight) ?? pickNum(row.target_weight_pct);

  return {
    id: String(row.id),
    portfolio_id: String(row.portfolio_id),
    rowStatus: parseRowStatus(row.row_status),
    symbol,
    name: String(row.name ?? symbol),
    quantity,
    expense_ratio: pickNum(row.expense_ratio),
    dividend_dollars: pickNum(row.dividend_dollars),
    target_parity_weight: targetWt,
    price_current,
    price_24h_basis: pickNum(row.price_24h_basis),
    price_7d_basis: pickNum(row.price_7d_basis),
    basis_price_3mo: pickNum(row.basis_price_3mo),
    basis_price_6mo: pickNum(row.basis_price_6mo),
    basis_price_1yr: pickNum(row.basis_price_1yr),
    basis_price_3yr: pickNum(row.basis_price_3yr),
    basis_price_5yr: pickNum(row.basis_price_5yr),
    volatility_3mo: pickNum(row.volatility_3mo),
    rsi_14: pickNum(row.rsi_14),
    last_market_refresh:
      (row.last_market_refresh as string | null) ??
      (row.last_price_refreshed_at as string | null) ??
      null,
    market_value,
    current_weight: pickNum(row.current_weight),
    div_apy: pickNum(row.div_apy),
    change_24h:
      pickNum(row.change_24h) ??
      (pickNum(row.last_change_pct) != null ? pickNum(row.last_change_pct)! / 100 : null),
    change_7d: pickNum(row.change_7d),
    return_3mo: pickNum(row.return_3mo),
    return_6mo: pickNum(row.return_6mo),
    return_1yr: pickNum(row.return_1yr),
    return_3yr: pickNum(row.return_3yr),
    return_5yr: pickNum(row.return_5yr),
    return_avg: pickNum(row.return_avg),
    return_weighted_avg: pickNum(row.return_weighted_avg),
    volatility_abs: pickNum(row.volatility_abs) ?? pickNum(row.volatility_3mo),
    volatility_signed: pickNum(row.volatility_signed),
    sub_rank_current: pickNum(row.sub_rank_current),
    sub_rank_expense: pickNum(row.sub_rank_expense),
    sub_rank_weighted_ret: pickNum(row.sub_rank_weighted_ret),
    sub_rank_div_apy: pickNum(row.sub_rank_div_apy),
    sub_rank_volatility: pickNum(row.sub_rank_volatility),
    sub_rank_thirteen_f: pickNum(row.sub_rank_thirteen_f),
    sub_rank_macro_intelligence: pickNum(row.sub_rank_macro_intelligence),
    sub_rank_governance_layer: pickNum(row.sub_rank_governance_layer),
    sub_rank_political_tracker: pickNum(row.sub_rank_political_tracker),
    sub_rank_token_quality: pickNum(row.sub_rank_token_quality),
    composite_score: pickNum(row.composite_score),
    rank_overall: pickNum(row.rank_overall),
    alert_primary: (row.alert_primary as string | null) ?? null,
    alert_secondary: (row.alert_secondary as string | null) ?? null,
    target_sleeve_pct: pickNum(row.target_sleeve_pct) ?? targetWt,
    parity_dollars: pickNum(row.parity_dollars),
    parity_change_dollars: pickNum(row.parity_change_dollars),
    shares_delta: pickNum(row.shares_delta),
  };
}

export function needsEngineMetricsRefresh(rows: ComputedRow[]): boolean {
  if (rows.length === 0) return false;
  return rows.some(
    (r) =>
      r.last_market_refresh == null &&
      (r.return_3mo == null || r.rsi_14 == null || r.rank_overall == null),
  );
}

export function computedRowToHoldingRecord(row: ComputedRow): Record<string, unknown> {
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    ticker: row.symbol,
    name: row.name,
    quantity: row.quantity,
    expense_ratio: row.expense_ratio,
    dividend_dollars: row.dividend_dollars,
    target_parity_weight: row.target_parity_weight,
    price_current: row.price_current,
    price_24h_basis: row.price_24h_basis,
    price_7d_basis: row.price_7d_basis,
    basis_price_3mo: row.basis_price_3mo,
    basis_price_6mo: row.basis_price_6mo,
    basis_price_1yr: row.basis_price_1yr,
    basis_price_3yr: row.basis_price_3yr,
    basis_price_5yr: row.basis_price_5yr,
    volatility_3mo: row.volatility_3mo,
    rsi_14: row.rsi_14,
    last_market_refresh: row.last_market_refresh,
    market_value: row.market_value,
    current_weight: row.current_weight,
    div_apy: row.div_apy,
    change_24h: row.change_24h,
    change_7d: row.change_7d,
    return_3mo: row.return_3mo,
    return_6mo: row.return_6mo,
    return_1yr: row.return_1yr,
    return_3yr: row.return_3yr,
    return_5yr: row.return_5yr,
    return_avg: row.return_avg,
    return_weighted_avg: row.return_weighted_avg,
    volatility_abs: row.volatility_abs,
    volatility_signed: row.volatility_signed,
    sub_rank_current: row.sub_rank_current,
    sub_rank_expense: row.sub_rank_expense,
    sub_rank_weighted_ret: row.sub_rank_weighted_ret,
    sub_rank_div_apy: row.sub_rank_div_apy,
    sub_rank_volatility: row.sub_rank_volatility,
    sub_rank_thirteen_f: row.sub_rank_thirteen_f,
    sub_rank_macro_intelligence: row.sub_rank_macro_intelligence,
    sub_rank_governance_layer: row.sub_rank_governance_layer,
    sub_rank_political_tracker: row.sub_rank_political_tracker,
    sub_rank_token_quality: row.sub_rank_token_quality,
    composite_score: row.composite_score,
    rank_overall: row.rank_overall,
    alert_primary: row.alert_primary,
    alert_secondary: row.alert_secondary,
    target_sleeve_pct: row.target_sleeve_pct,
    parity_dollars: row.parity_dollars,
    parity_change_dollars: row.parity_change_dollars,
    shares_delta: row.shares_delta,
  };
}

export function mergeRealtimeIntoRow(row: ComputedRow, rawNew: Record<string, unknown>): ComputedRow {
  return mapHoldingToComputedRow({
    ...computedRowToHoldingRecord(row),
    ...rawNew,
  });
}
