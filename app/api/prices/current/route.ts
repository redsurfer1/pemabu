import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketDataWithFallback } from "@/lib/market-data/fetch-market-data";
import { normalizeTicker } from "@/lib/market-data/normalize-ticker";
import { checkRateLimit, PRICES_RATE_LIMIT } from "@/lib/security/rate-limiter";

export const GET = withAuth(async (request, user, _ctx) => {
  const rateLimit = await checkRateLimit({ key: `prices:${user.id}`, ...PRICES_RATE_LIMIT });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");

  if (!tickersParam) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());
  const supabase = await createClient();
  const now = new Date();

  const cacheKeys = tickers.map((t) => `current:${t}` as const);

  const { data: cachedRows } = await supabase
    .from("price_cache")
    .select("cache_key, price, fetched_at, ttl_seconds")
    .in("cache_key", cacheKeys);

  const cacheMap = new Map((cachedRows ?? []).map((r) => [String(r.cache_key), r]));
  const freshCacheKeys = new Set<string>();
  const freshTickerResults: Record<string, number> = {};

  for (const ticker of tickers) {
    if (ticker === "CASH") {
      freshTickerResults[ticker] = 1;
      continue;
    }
    const cached = cacheMap.get(`current:${ticker}`);
    if (cached) {
      const fetchedAt = new Date(cached.fetched_at);
      const expiresAt = new Date(fetchedAt.getTime() + cached.ttl_seconds * 1000);
      if (expiresAt > now) {
        freshTickerResults[ticker] = Number(cached.price);
        freshCacheKeys.add(`current:${ticker}`);
      }
    }
  }

  const needsFetch = tickers.filter(
    (t) => t !== "CASH" && !freshCacheKeys.has(`current:${t}`),
  );

  const fetchResults = await Promise.allSettled(
    needsFetch.map(async (ticker) => {
      const md = await fetchMarketDataWithFallback(normalizeTicker(ticker));
      if (md.error || md.price1 <= 0) return null;
      await supabase.from("price_cache").upsert(
        { cache_key: `current:${ticker}`, price: md.price1, fetched_at: now.toISOString(), ttl_seconds: 900 },
        { onConflict: "cache_key" },
      );
      return { ticker, price: md.price1 };
    }),
  );

  const results: Record<string, number> = { ...freshTickerResults };
  for (const result of fetchResults) {
    if (result.status === "fulfilled" && result.value) {
      results[result.value.ticker] = result.value.price;
    }
  }

  return NextResponse.json(results);
});
