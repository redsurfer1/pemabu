/**
 * Server-side price service using licensed Tiingo market data.
 * Never called from the client. All methods require server context.
 */

import { createClient } from "@/lib/supabase/server";
import { fetchMarketDataTiingo } from "@/lib/market-data/tiingo";
import { normalizeTicker } from "@/lib/market-data/normalize-ticker";

type PeriodKey = "3mo" | "6mo" | "1yr" | "3yr" | "5yr";

const PERIOD_BASIS: Record<PeriodKey, keyof Awaited<ReturnType<typeof fetchMarketDataTiingo>>> = {
  "3mo": "basisPrice3mo",
  "6mo": "basisPrice6mo",
  "1yr": "basisPrice1yr",
  "3yr": "basisPrice3yr",
  "5yr": "basisPrice5yr",
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getCachedPrice(
  ticker: string,
  period: string,
  dateStr: string,
): Promise<number | null> {
  const supabase = await createClient();
  const cacheKey = `${period === "current" ? "current" : "hist"}:${ticker}:${period}:${dateStr}`;
  const { data } = await supabase
    .from("price_cache")
    .select("price, fetched_at, ttl_seconds")
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (!data) return null;
  const expiresAt = new Date(data.fetched_at).getTime() + data.ttl_seconds * 1000;
  if (Date.now() > expiresAt) return null;
  return Number(data.price);
}

async function setCachedPrice(
  ticker: string,
  period: string,
  dateStr: string,
  price: number,
  ttlSeconds: number,
): Promise<void> {
  const supabase = await createClient();
  const cacheKey = `${period === "current" ? "current" : "hist"}:${ticker}:${period}:${dateStr}`;
  await supabase.from("price_cache").upsert(
    {
      cache_key: cacheKey,
      ticker,
      period,
      cache_date: dateStr,
      price,
      fetched_at: new Date().toISOString(),
      ttl_seconds: ttlSeconds,
    },
    { onConflict: "cache_key" },
  );
}

export async function getCurrentPrices(
  tickers: string[],
): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};
  const date = todayStr();
  const results: Record<string, number> = {};

  const marketTickers = tickers.filter((t) => {
    if (t === "CASH") {
      results["CASH"] = 1;
      return false;
    }
    return true;
  });
  if (marketTickers.length === 0) return results;

  const toFetch: string[] = [];

  for (const ticker of marketTickers) {
    const cached = await getCachedPrice(ticker, "current", date);
    if (cached !== null) {
      results[ticker] = cached;
    } else {
      toFetch.push(ticker);
    }
  }

  for (const ticker of toFetch) {
    try {
      const md = await fetchMarketDataTiingo(normalizeTicker(ticker));
      if (md.error || md.price1 <= 0) continue;
      results[ticker] = md.price1;
      await setCachedPrice(ticker, "current", date, md.price1, 900);
    } catch {
      /* caller uses fallback */
    }
  }

  return results;
}

export async function getHistoricalPrices(
  tickers: string[],
  periods: PeriodKey[] = ["3mo", "6mo", "1yr", "3yr", "5yr"],
): Promise<Record<string, Record<string, number>>> {
  if (tickers.length === 0) return {};
  const date = todayStr();
  const results: Record<string, Record<string, number>> = {};

  for (const ticker of tickers) {
    results[ticker] = {};
    if (ticker === "CASH") {
      for (const period of periods) {
        results[ticker]![period] = 1;
      }
      continue;
    }

    let md: Awaited<ReturnType<typeof fetchMarketDataTiingo>> | null = null;

    for (const period of periods) {
      const cacheKeyDate = date;
      const cached = await getCachedPrice(ticker, period, cacheKeyDate);
      if (cached !== null) {
        results[ticker]![period] = cached;
        continue;
      }

      if (!md) {
        try {
          md = await fetchMarketDataTiingo(normalizeTicker(ticker));
        } catch {
          md = null;
        }
      }

      const basisKey = PERIOD_BASIS[period];
      const price = md && !md.error ? Number(md[basisKey]) : 0;
      if (price > 0) {
        results[ticker]![period] = price;
        await setCachedPrice(ticker, period, cacheKeyDate, price, 86400);
      }
    }
  }

  return results;
}
