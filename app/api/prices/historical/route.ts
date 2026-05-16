import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
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

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const GET = withAuth(async (request, _user, _ctx) => {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  const periodsParam = searchParams.get("periods");

  if (!tickersParam) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());
  const periods = (periodsParam?.split(",") ?? Object.keys(PERIOD_MONTHS)) as PeriodKey[];

  const supabase = await createClient();
  const today = new Date();

  const results: Record<string, Record<string, number>> = {};

  for (const ticker of tickers) {
    results[ticker] = {};

    for (const period of periods) {
      const months = PERIOD_MONTHS[period];
      if (!months) continue;

      const targetDate = subtractMonths(today, months);
      const cacheKey = `hist:${ticker}:${period}:${formatDateKey(targetDate)}`;

      // Check cache
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

      // Fetch from Yahoo Finance
      try {
        const yahooFinance = (await import("yahoo-finance2")).default;
        const period1 = new Date(targetDate);
        period1.setDate(period1.getDate() - 5);
        const period2 = new Date(targetDate);
        period2.setDate(period2.getDate() + 5);

        const historical = await yahooFinance.historical(ticker, {
          period1: period1.toISOString().slice(0, 10),
          period2: period2.toISOString().slice(0, 10),
          interval: "1d",
        }) as Array<{ date: string | Date; close?: number }>;

        // Find closest price on or before target date
        const beforeTarget = historical
          .filter((row) => new Date(row.date) <= targetDate)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const price = beforeTarget[0]?.close ?? historical[0]?.close;
        if (price != null) {
          results[ticker]![period] = price;

          // Cache with 24h TTL
          await supabase.from("price_cache").upsert(
            { cache_key: cacheKey, price, fetched_at: new Date().toISOString(), ttl_seconds: 86400 },
            { onConflict: "cache_key" },
          );
        }
      } catch {
        // Skip this ticker/period on error
      }
    }
  }

  return NextResponse.json(results);
});
