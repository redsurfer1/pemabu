// lib/market-data/index.ts
// Returns the active provider based on env var.
// Add new providers here when upgrading pre-launch.

import { googleFinanceProvider } from "./google-finance";
import type { MarketDataProvider } from "./types";

export function getActiveProvider(): MarketDataProvider {
  const provider = process.env.MARKET_DATA_PROVIDER;
  switch (provider) {
    case "google-finance":
      return googleFinanceProvider;
    default:
      // Fail loudly — Zod in lib/env.ts catches this
      // at startup, but guard here defensively
      throw new Error(
        `Unknown MARKET_DATA_PROVIDER: ${provider}. ` + `Valid values: 'google-finance'`,
      );
  }
}

export type { MarketDataProvider, Quote, QuoteBatchResult } from "./types";
