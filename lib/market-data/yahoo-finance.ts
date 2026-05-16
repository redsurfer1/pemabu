import { computeRSI } from "@/lib/portfolio/formula-engine";

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

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        symbol?: string;
        shortName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string };
  };
};

function pickClosestClose(history: Array<{ tsMs: number; close: number }>, targetMs: number): number {
  let best = history[0]!;
  let bestDiff = Math.abs(best.tsMs - targetMs);
  for (let i = 1; i < history.length; i++) {
    const row = history[i]!;
    const d = Math.abs(row.tsMs - targetMs);
    if (d < bestDiff) {
      bestDiff = d;
      best = row;
    }
  }
  return best.close;
}

function computeVolatilityAnnualized(closes: number[]): number | null {
  if (closes.length < 64) return null;
  const recent = closes.slice(-63);
  const logReturns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1]!;
    const next = recent[i]!;
    if (prev > 0 && next > 0) {
      logReturns.push(Math.log(next / prev));
    }
  }
  if (logReturns.length < 2) return null;
  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (logReturns.length - 1);
  const stddev = Math.sqrt(variance);
  return Math.round(stddev * Math.sqrt(252) * 1_000_000) / 1_000_000;
}

const CRYPTO_SUFFIXES = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC',
  'LINK', 'UNI', 'LTC', 'DOGE', 'SHIB', 'ARB', 'OP', 'APT', 'SUI',
  'ATOM', 'NEAR', 'FTM', 'INJ', 'TIA', 'SEI', 'STX', 'IMX', 'SAND',
  'MANA', 'AXS', 'GRT', 'AAVE', 'CRV', 'MKR', 'SNX', 'COMP', 'YFI',
  'SUSHI', 'BAL', 'FXS', 'LDO', 'RPL', 'GMX', 'PENDLE', 'JTO', 'WIF',
  'BONK', 'PEPE', 'FLOKI',
];

export function normalizeTicker(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith('-USD') || t.endsWith('-USDT') || t.endsWith('-BTC')) return t;
  if (CRYPTO_SUFFIXES.includes(t)) return `${t}-USD`;
  return t;
}

export async function fetchMarketData(ticker: string): Promise<MarketDataResult> {
  const upper = ticker.trim().toUpperCase();
  const nowIso = new Date().toISOString();
  const empty: MarketDataResult = {
    ticker: upper,
    name: upper,
    price1: 0,
    price2: 0,
    price3: 0,
    basisPrice3mo: 0,
    basisPrice6mo: 0,
    basisPrice1yr: 0,
    basisPrice3yr: 0,
    basisPrice5yr: 0,
    recentCloses: [],
    volatility3mo: null,
    currency: "USD",
    fetchedAt: nowIso,
  };

  try {
    const yahooTicker = normalizeTicker(upper);
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}` +
      `?interval=1d&range=5y`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return { ...empty, error: `Yahoo HTTP ${res.status}` };
    }

    const payload = (await res.json()) as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    if (!result) {
      return { ...empty, error: payload.chart?.error?.description ?? "No Yahoo chart result" };
    }

    const timestamps = result.timestamp ?? [];
    const closesRaw = result.indicators?.quote?.[0]?.close ?? [];
    const history = timestamps
      .map((ts, i) => ({ tsMs: ts * 1000, close: closesRaw[i] }))
      .filter((x): x is { tsMs: number; close: number } => x.close != null && Number.isFinite(x.close));

    if (history.length === 0) {
      return { ...empty, error: "No close prices in Yahoo response" };
    }

    const closes = history.map((h) => h.close);
    const current = history[history.length - 1]!;
    const yday = history[Math.max(0, history.length - 2)]!;
    const wday = history[Math.max(0, history.length - 6)]!;
    const nowMs = current.tsMs;

    const basisPrice3mo = pickClosestClose(history, nowMs - 91 * 24 * 3600 * 1000);
    const basisPrice6mo = pickClosestClose(history, nowMs - 183 * 24 * 3600 * 1000);
    const basisPrice1yr = pickClosestClose(history, nowMs - 365 * 24 * 3600 * 1000);
    const basisPrice3yr = pickClosestClose(history, nowMs - 1095 * 24 * 3600 * 1000);
    const basisPrice5yr = pickClosestClose(history, nowMs - 1825 * 24 * 3600 * 1000);

    const recentCloses = closes.slice(-40);
    const volatility3mo = computeVolatilityAnnualized(closes);
    void computeRSI(recentCloses); // validated by caller-side engine flow

    return {
      ticker: upper,
      name: result.meta?.shortName ?? upper,
      price1: current.close,
      price2: yday.close,
      price3: wday.close,
      basisPrice3mo,
      basisPrice6mo,
      basisPrice1yr,
      basisPrice3yr,
      basisPrice5yr,
      recentCloses,
      volatility3mo,
      currency: result.meta?.currency ?? "USD",
      fetchedAt: nowIso,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...empty, error: message };
  }
}

const TIINGO_FALLBACK_STATUSES = new Set([429, 500, 502, 503, 504]);

const TRANSIENT_ERROR_SUBSTRINGS = [
  "429",
  "500",
  "502",
  "503",
  "504",
  "rate limit",
  "timeout",
  "ECONNRESET",
  "ECONNREFUSED",
  "fetch failed",
] as const;

function shouldFallbackToTiingo(yahooError: string): boolean {
  const lower = yahooError.toLowerCase();
  for (const s of TRANSIENT_ERROR_SUBSTRINGS) {
    if (lower.includes(s.toLowerCase())) return true;
  }
  const m = /(?:yahoo\s+http|http)\s*(\d{3})/i.exec(yahooError);
  if (m?.[1]) {
    const code = Number(m[1]);
    if (TIINGO_FALLBACK_STATUSES.has(code)) return true;
  }
  return false;
}

export type MarketDataFetchOptions = {
  /** Portfolio-specific Tiingo token; falls back to TIINGO_API_KEY env. */
  tiingoToken?: string | null;
};

export async function fetchMarketDataWithFallback(
  ticker: string,
  options?: MarketDataFetchOptions,
): Promise<MarketDataResult & { provider: "yahoo" | "tiingo" }> {
  const yahooResult = await fetchMarketData(ticker);
  if (yahooResult.error == null) {
    return { ...yahooResult, provider: "yahoo" };
  }
  const yErr = String(yahooResult.error);
  if (!shouldFallbackToTiingo(yErr)) {
    return { ...yahooResult, provider: "yahoo" };
  }
  const { fetchMarketDataTiingo } = await import("./tiingo");
  const tiingoResult = await fetchMarketDataTiingo(ticker, { token: options?.tiingoToken });
  if (tiingoResult.error == null) {
    return { ...tiingoResult, provider: "tiingo" };
  }
  const tErr = String(tiingoResult.error);
  return {
    ...yahooResult,
    error: `Yahoo: ${yErr} | Tiingo: ${tErr}`,
    provider: "yahoo",
  };
}

const _priceCache = new Map<string, { result: MarketDataResult & { provider: "yahoo" | "tiingo" }; fetchedAt: number }>();
const PRICE_CACHE_TTL_MS = 60 * 1000;

export async function fetchMarketDataCached(
  ticker: string,
  options?: MarketDataFetchOptions,
): Promise<MarketDataResult & { provider: "yahoo" | "tiingo" }> {
  const key = `${ticker.trim().toUpperCase()}:${options?.tiingoToken ? "custom" : "default"}`;
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
