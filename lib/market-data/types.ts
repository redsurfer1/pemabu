// lib/market-data/types.ts
// Provider interface — swap provider by changing
// MARKET_DATA_PROVIDER env var, not application code.

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
