/** Fiat / cash tickers for the per-portfolio USD watchlist quick-add chips. */
export const FIAT_WATCH_TICKERS = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "CHF",
  "JPY",
  "CASH",
] as const;

export type FiatWatchTicker = (typeof FIAT_WATCH_TICKERS)[number];

export const ROW_STATUS = {
  ACTIVE: "Active",
  COMPARABLE: "Comparable",
  WATCH: "Watch",
} as const;

export type RowStatus = (typeof ROW_STATUS)[keyof typeof ROW_STATUS];

export function parseRowStatus(value: unknown): RowStatus {
  if (value === ROW_STATUS.COMPARABLE) return ROW_STATUS.COMPARABLE;
  if (value === ROW_STATUS.WATCH) return ROW_STATUS.WATCH;
  return ROW_STATUS.ACTIVE;
}

export function isFiatWatchTicker(ticker: string): boolean {
  return (FIAT_WATCH_TICKERS as readonly string[]).includes(ticker.toUpperCase());
}
