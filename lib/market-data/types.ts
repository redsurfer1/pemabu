// lib/market-data/types.ts
// Provider interface — swap provider by changing
// MARKET_DATA_PROVIDER env var, not application code.
//
// PriceResult is the unified price value-object used across the application.
// All three market-data subsystems (google-finance provider, yahoo-finance
// enrichment, priceService/yahoo-finance2) should return or map to this shape.

export type QuoteErrorKind =
  | "rate_limit"
  | "not_found"
  | "provider_error"
  | "timeout"
  | "auth_error";

export interface Quote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  asOf: Date;
  source: string;
  exchange?: string;
}

export interface QuoteBatchResult {
  quotes: Quote[];
  errors: Array<{
    ticker: string;
    kind: QuoteErrorKind;
    code?: string;
    message: string;
  }>;
}

/**
 * Unified price value-object.  All market-data subsystems should map their
 * raw output to this shape before returning to callers.
 */
export interface PriceResult {
  ticker: string;
  price: number;
  currency: string;
  asOf: Date;
  source: string;
  /**
   * True when `asOf` is older than `staleThresholdMs`.
   * Set by `isPriceStale()` — callers control the threshold.
   */
  isStale: boolean;
}

/**
 * Returns true when a price timestamp is older than `thresholdMs`.
 * Default threshold is 8 hours (covers after-hours gaps on trading days).
 */
export function isPriceStale(
  asOf: Date | string | null | undefined,
  thresholdMs = 8 * 60 * 60 * 1000,
): boolean {
  if (!asOf) return true;
  return Date.now() - new Date(asOf).getTime() > thresholdMs;
}

export interface MarketDataProvider {
  readonly id: string;
  readonly batchSize: number;
  getQuote(ticker: string, options?: { exchange?: string }): Promise<Quote | null>;
  getQuotes(tickers: string[]): Promise<QuoteBatchResult>;
  healthCheck(): Promise<{
    ok: boolean;
    provider: string;
    latencyMs: number;
    message?: string;
  }>;
}
