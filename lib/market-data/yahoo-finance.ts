/**
 * @deprecated Yahoo Finance is no longer used. Re-exports the Tiingo-backed fetch layer
 * so existing imports keep working during migration.
 */
export {
  fetchMarketData,
  fetchMarketDataWithFallback,
  fetchMarketDataCached,
  clearPriceCache,
  normalizeTicker,
  type MarketDataFetchOptions,
  type MarketDataResult,
} from "./fetch-market-data";
