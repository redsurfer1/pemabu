export interface MarketDataResult {
  ticker: string;
  name: string;
  price1: number;
  price2: number;
  price3: number;
  basisPrice3mo: number;
  basisPrice6mo: number;
  basisPrice1yr: number;
  basisPrice3yr: number;
  basisPrice5yr: number;
  recentCloses: number[];
  volatility3mo: number | null;
  currency: string;
  fetchedAt: string;
  error?: string;
}

export type MarketDataProviderId = "tiingo";

export function cashMarketDataResult(ticker = "CASH"): MarketDataResult {
  const nowIso = new Date().toISOString();
  return {
    ticker,
    name: "Cash",
    price1: 1,
    price2: 1,
    price3: 1,
    basisPrice3mo: 1,
    basisPrice6mo: 1,
    basisPrice1yr: 1,
    basisPrice3yr: 1,
    basisPrice5yr: 1,
    recentCloses: Array(40).fill(1),
    volatility3mo: 0,
    currency: "USD",
    fetchedAt: nowIso,
  };
}
