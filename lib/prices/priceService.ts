/**
 * Server-side price service using yahoo-finance2.
 * Never called from the client. All methods require server context.
 */

import { createClient } from "@/lib/supabase/server";

type PeriodKey = "3mo" | "6mo" | "1yr" | "3yr" | "5yr";

const PERIOD_MONTHS: Record<PeriodKey, number> = {
  "3mo": 3,
  "6mo": 6,
  "1yr": 12,
  "3yr": 36,
  "5yr": 60,
};

function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return formatDate(new Date());
}

// ── Cache helpers ────────────────────────────────────────────────────

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

// ── getCurrentPrices ─────────────────────────────────────────────────

const BATCH_SIZE = 10;

export async function getCurrentPrices(
  tickers: string[],
): Promise<Record<string, number>> {
  if (tickers.length === 0) return {};
  const date = todayStr();
  const results: Record<string, number> = {};

  // CASH is always $1.00 — never hit market data for it
  const marketTickers = tickers.filter((t) => {
    if (t === "CASH") { results["CASH"] = 1.00; return false; }
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

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (ticker) => {
        try {
          const yahooFinance = (await import("yahoo-finance2")).default;
          const quote = await yahooFinance.quote(ticker) as { regularMarketPrice?: number };
          const price = quote.regularMarketPrice;
          if (price != null) {
            results[ticker] = price;
            await setCachedPrice(ticker, "current", date, price, 900); // 15-min TTL
          }
        } catch {
          // leave out of results — caller uses price_seed as fallback
        }
      }),
    );
  }

  return results;
}

// ── getHistoricalPrices ──────────────────────────────────────────────

export async function getHistoricalPrices(
  tickers: string[],
  periods: PeriodKey[] = ["3mo", "6mo", "1yr", "3yr", "5yr"],
): Promise<Record<string, Record<string, number>>> {
  if (tickers.length === 0) return {};
  const today = new Date();
  const results: Record<string, Record<string, number>> = {};

  for (const ticker of tickers) {
    results[ticker] = {};
    for (const period of periods) {
      const months = PERIOD_MONTHS[period];
      const targetDate = subtractMonths(today, months);
      const dateStr = formatDate(targetDate);

      const cached = await getCachedPrice(ticker, period, dateStr);
      if (cached !== null) {
        results[ticker]![period] = cached;
        continue;
      }

      try {
        const yahooFinance = (await import("yahoo-finance2")).default;
        const period1 = formatDate(addDays(targetDate, -5));
        const period2 = formatDate(addDays(targetDate, 7));

        const historical = await yahooFinance.historical(ticker, {
          period1,
          period2,
          interval: "1d",
        }) as Array<{ date: string | Date; close?: number; adjClose?: number }>;

        if (historical.length === 0) continue;

        // Find closest date on or after targetDate (nearest trading day)
        const onOrAfter = historical
          .filter((row) => new Date(row.date) >= targetDate)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const row = onOrAfter[0] ?? historical[0];
        const price = row?.adjClose ?? row?.close;
        if (price != null) {
          results[ticker]![period] = price;
          await setCachedPrice(ticker, period, dateStr, price, 86400); // 24h TTL
        }
      } catch {
        // leave out — 0 will be used by engine
      }
    }
  }

  return results;
}
