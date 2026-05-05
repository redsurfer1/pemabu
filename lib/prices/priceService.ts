/**
 * Server-side Yahoo Finance quotes with Supabase price_cache.
 * Used by API routes and server actions (no HTTP round-trip).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { subMonths, addDays } from "date-fns";
import yahooFinance from "yahoo-finance2";

const CURRENT_TTL_SEC = 900;
const HIST_TTL_SEC = 86400;
const BATCH = 10;

export type HistoricalPeriod = "3mo" | "6mo" | "1yr" | "3yr" | "5yr";

const PERIOD_MONTHS: Record<HistoricalPeriod, number> = {
  "3mo": 3,
  "6mo": 6,
  "1yr": 12,
  "3yr": 36,
  "5yr": 60,
};

function cacheDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getCurrentPrices(
  supabase: SupabaseClient,
  tickers: string[],
): Promise<Record<string, number>> {
  const upper = [...new Set(tickers.map((t) => t.trim().toUpperCase()))];
  const results: Record<string, number> = {};
  const now = new Date();

  for (let i = 0; i < upper.length; i += BATCH) {
    const chunk = upper.slice(i, i + BATCH);
    await Promise.all(
      chunk.map(async (ticker) => {
        const cacheKey = `current:${ticker}`;
        const { data: cached } = await supabase
          .from("price_cache")
          .select("price, fetched_at, ttl_seconds")
          .eq("cache_key", cacheKey)
          .maybeSingle();

        if (cached) {
          const fetchedAt = new Date(cached.fetched_at);
          const expiresAt = new Date(fetchedAt.getTime() + cached.ttl_seconds * 1000);
          if (expiresAt > now) {
            results[ticker] = Number(cached.price);
            return;
          }
        }

        try {
          const quote = (await yahooFinance.quote(ticker)) as { regularMarketPrice?: number };
          const price = quote.regularMarketPrice;
          if (price != null) {
            results[ticker] = price;
            await supabase.from("price_cache").upsert(
              {
                cache_key: cacheKey,
                price,
                fetched_at: now.toISOString(),
                ttl_seconds: CURRENT_TTL_SEC,
              },
              { onConflict: "cache_key" },
            );
          }
        } catch {
          /* skip */
        }
      }),
    );
  }

  return results;
}

export async function getHistoricalPrices(
  supabase: SupabaseClient,
  tickers: string[],
  periods: HistoricalPeriod[] = ["3mo", "6mo", "1yr", "3yr", "5yr"],
): Promise<Record<string, Record<string, number>>> {
  const upper = [...new Set(tickers.map((t) => t.trim().toUpperCase()))];
  const results: Record<string, Record<string, number>> = {};
  const today = new Date();

  for (const ticker of upper) {
    results[ticker] = {};

    for (const period of periods) {
      const months = PERIOD_MONTHS[period];
      const targetDate = subMonths(today, months);
      const cacheKey = `hist:${ticker}:${period}:${cacheDateStr(targetDate)}`;

      const { data: cached } = await supabase
        .from("price_cache")
        .select("price, fetched_at, ttl_seconds")
        .eq("cache_key", cacheKey)
        .maybeSingle();

      if (cached) {
        const fetchedAt = new Date(cached.fetched_at);
        const expiresAt = new Date(fetchedAt.getTime() + cached.ttl_seconds * 1000);
        if (expiresAt > today) {
          results[ticker]![period] = Number(cached.price);
          continue;
        }
      }

      try {
        const period1 = addDays(targetDate, -5);
        const period2 = addDays(targetDate, 7);

        const historical = (await yahooFinance.historical(ticker, {
          period1,
          period2,
          interval: "1d",
        })) as Array<{ date: string | Date; close?: number }>;

        const beforeTarget = historical
          .filter((row) => new Date(row.date) <= targetDate)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const price = beforeTarget[0]?.close ?? historical[0]?.close;
        if (price != null) {
          results[ticker]![period] = price;
          await supabase.from("price_cache").upsert(
            {
              cache_key: cacheKey,
              price,
              fetched_at: new Date().toISOString(),
              ttl_seconds: HIST_TTL_SEC,
            },
            { onConflict: "cache_key" },
          );
        }
      } catch {
        /* skip */
      }
    }
  }

  return results;
}
