import { cashMarketDataResult, type MarketDataResult, type MarketDataProviderId } from "./market-data-result";
import { normalizeTicker } from "./normalize-ticker";
import { fetchMarketDataTiingo } from "./tiingo";

export type { MarketDataResult, MarketDataProviderId } from "./market-data-result";
export { normalizeTicker } from "./normalize-ticker";

export type MarketDataFetchOptions = {
  /** Portfolio-specific Tiingo token; falls back to TIINGO_API_KEY env. */
  tiingoToken?: string | null;
};

export type MarketDataFetchResult = MarketDataResult & { provider: MarketDataProviderId };

/**
 * Licensed market data via Tiingo (paid tier). Yahoo Finance is not used.
 */
export async function fetchMarketDataWithFallback(
  ticker: string,
  options?: MarketDataFetchOptions,
): Promise<MarketDataFetchResult> {
  const upper = normalizeTicker(ticker);
  if (upper === "CASH") {
    return { ...cashMarketDataResult(upper), provider: "tiingo" };
  }

  const tiingoResult = await fetchMarketDataTiingo(upper, { token: options?.tiingoToken });
  return { ...tiingoResult, provider: "tiingo" };
}

const _priceCache = new Map<string, { result: MarketDataFetchResult; fetchedAt: number }>();
const PRICE_CACHE_TTL_MS = 60 * 1000;

export async function fetchMarketDataCached(
  ticker: string,
  options?: MarketDataFetchOptions,
): Promise<MarketDataFetchResult> {
  const key = `${normalizeTicker(ticker)}:${options?.tiingoToken ? "custom" : "default"}`;
  const cached = _priceCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < PRICE_CACHE_TTL_MS) {
    return cached.result;
  }
  const result = await fetchMarketDataWithFallback(ticker, options);
  _priceCache.set(key, { result, fetchedAt: Date.now() });
  return result;
}

export function clearPriceCache(): void {
  _priceCache.clear();
}

/** @deprecated Use fetchMarketDataWithFallback — Tiingo is the only provider. */
export const fetchMarketData = fetchMarketDataWithFallback;
