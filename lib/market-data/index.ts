// lib/market-data/index.ts
// Licensed market data via Tiingo (MARKET_DATA_PROVIDER=tiingo).

import { tiingoProvider } from "./tiingo-provider";
import type { MarketDataProvider } from "./types";

export function getActiveProvider(): MarketDataProvider {
  const raw = process.env.MARKET_DATA_PROVIDER ?? "tiingo";
  const provider = raw === "google-finance" ? "tiingo" : raw;
  if (provider === "tiingo") {
    return tiingoProvider;
  }
  throw new Error(
    `Unknown MARKET_DATA_PROVIDER: ${raw}. Valid value: 'tiingo' (legacy 'google-finance' is mapped to tiingo).`,
  );
}

export type { MarketDataProvider, Quote, QuoteBatchResult, PriceResult } from "./types";
export { isPriceStale } from "./types";
export { tiingoProvider } from "./tiingo-provider";
