import { normalizeTicker } from "@/lib/market-data/normalize-ticker";

function resolveTiingoToken(override?: string | null): string {
  const token = override?.trim() || process.env.TIINGO_API_KEY?.trim();
  if (!token) {
    throw new Error("TIINGO_API_KEY is not set");
  }
  return token;
}

type TiingoPriceRow = {
  date: string;
  adjClose?: number | null;
  close?: number | null;
};

type TiingoCryptoPriceData = {
  date: string;
  close?: number | null;
};

type TiingoCryptoResponse = Array<{
  priceData?: TiingoCryptoPriceData[];
}>;

function startDateOneYearAgo(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

function isCryptoUsdTicker(ticker: string): boolean {
  return ticker.endsWith("-USD");
}

/**
 * Licensed daily close series from Tiingo (equity adjClose; crypto close).
 * Used for macro correlation and other return-based analytics.
 */
export async function fetchTiingoDailyCloses(
  ticker: string,
  options?: { startDate?: string; token?: string | null },
): Promise<number[]> {
  const upper = normalizeTicker(ticker);
  const startDate = options?.startDate ?? startDateOneYearAgo();
  const token = resolveTiingoToken(options?.token);
  const headers: HeadersInit = {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };

  if (isCryptoUsdTicker(upper)) {
    const base = upper.toLowerCase().replace("-usd", "");
    const url =
      `https://api.tiingo.com/tiingo/crypto/prices?tickers=${encodeURIComponent(`${base}usd`)}` +
      `&resampleFreq=1day&startDate=${encodeURIComponent(startDate)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as TiingoCryptoResponse;
    const rows = data?.[0]?.priceData ?? [];
    const closes: number[] = [];
    for (const row of rows) {
      const c = row.close;
      if (c != null && Number.isFinite(c)) closes.push(c);
    }
    return closes;
  }

  const url =
    `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(upper)}/prices` +
    `?startDate=${encodeURIComponent(startDate)}&resampleFreq=daily`;
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  const rows = (await res.json()) as TiingoPriceRow[];
  if (!Array.isArray(rows)) return [];
  const closes: number[] = [];
  for (const row of rows) {
    const c = row.adjClose ?? row.close;
    if (c != null && Number.isFinite(c)) closes.push(c);
  }
  return closes;
}
