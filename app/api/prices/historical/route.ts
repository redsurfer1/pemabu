import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketDataWithFallback } from "@/lib/market-data/fetch-market-data";
import { normalizeTicker } from "@/lib/market-data/normalize-ticker";
import { checkRateLimit, PRICES_RATE_LIMIT } from "@/lib/security/rate-limiter";

type PeriodKey = "3mo" | "6mo" | "1yr" | "3yr" | "5yr";

const PERIOD_BASIS: Record<PeriodKey, "basisPrice3mo" | "basisPrice6mo" | "basisPrice1yr" | "basisPrice3yr" | "basisPrice5yr"> = {
  "3mo": "basisPrice3mo",
  "6mo": "basisPrice6mo",
  "1yr": "basisPrice1yr",
  "3yr": "basisPrice3yr",
  "5yr": "basisPrice5yr",
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const GET = withAuth(async (request, user, _ctx) => {
  const rateLimit = await checkRateLimit({ key: `prices-historical:${user.id}`, ...PRICES_RATE_LIMIT });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  const periodsParam = searchParams.get("periods");

  if (!tickersParam) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());
  const periods = (periodsParam?.split(",") ?? Object.keys(PERIOD_BASIS)) as PeriodKey[];

  const supabase = await createClient();
  const today = new Date();
  const dateKey = todayKey();

  const results: Record<string, Record<string, number>> = {};
  const initialEntries: Array<[string, string, number]> = [];

  for (const ticker of tickers) {
    results[ticker] = {};
    if (ticker === "CASH") {
      for (const period of periods) {
        if (period in PERIOD_BASIS) {
          results[ticker]![period] = 1;
          initialEntries.push([ticker, period, 1]);
        }
      }
    }
  }

  const allCacheKeys = tickers.flatMap((t) =>
    t === "CASH" ? [] : periods.filter((p) => p in PERIOD_BASIS).map((p) => `hist:${t}:${p}:${dateKey}`),
  );

  const { data: cachedRows } =
    allCacheKeys.length > 0
      ? await supabase.from("price_cache").select("cache_key, price, fetched_at, ttl_seconds").in("cache_key", allCacheKeys)
      : { data: [] };

  const cacheMap = new Map((cachedRows ?? []).map((r) => [String(r.cache_key), r]));
  const freshCacheKeys = new Set<string>();

  for (const ticker of tickers) {
    if (ticker === "CASH") continue;
    for (const period of periods) {
      if (!(period in PERIOD_BASIS)) continue;
      const ck = `hist:${ticker}:${period}:${dateKey}`;
      const cached = cacheMap.get(ck);
      if (cached) {
        const fetchedAt = new Date(cached.fetched_at);
        const expiresAt = new Date(fetchedAt.getTime() + cached.ttl_seconds * 1000);
        if (expiresAt > today) {
          results[ticker]![period] = Number(cached.price);
          freshCacheKeys.add(ck);
        }
      }
    }
  }

  const needsFetch = tickers.filter((t) => t !== "CASH");
  const fetchResults = await Promise.allSettled(
    needsFetch.map(async (ticker) => {
      const md = await fetchMarketDataWithFallback(normalizeTicker(ticker));
      if (md.error) return { ticker, periods: [] as Array<{ period: PeriodKey; price: number }> };

      const found: Array<{ period: PeriodKey; price: number }> = [];
      for (const period of periods) {
        if (!(period in PERIOD_BASIS)) continue;
        if (freshCacheKeys.has(`hist:${ticker}:${period}:${dateKey}`)) continue;
        const basisKey = PERIOD_BASIS[period];
        const price = md[basisKey];
        if (price > 0) {
          found.push({ period, price });
          await supabase.from("price_cache").upsert(
            { cache_key: `hist:${ticker}:${period}:${dateKey}`, price, fetched_at: new Date().toISOString(), ttl_seconds: 86400 },
            { onConflict: "cache_key" },
          );
        }
      }
      return { ticker, periods: found };
    }),
  );

  for (const result of fetchResults) {
    if (result.status === "fulfilled") {
      for (const p of result.value.periods) {
        results[result.value.ticker]![p.period] = p.price;
      }
    }
  }

  return NextResponse.json(results);
});
