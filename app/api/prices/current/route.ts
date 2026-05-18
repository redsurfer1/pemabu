import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketDataWithFallback } from "@/lib/market-data/fetch-market-data";
import { normalizeTicker } from "@/lib/market-data/normalize-ticker";

export const GET = withAuth(async (request, _user, _ctx) => {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");

  if (!tickersParam) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());
  const supabase = await createClient();
  const now = new Date();

  const results: Record<string, number> = {};

  for (const ticker of tickers) {
    if (ticker === "CASH") {
      results[ticker] = 1;
      continue;
    }

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
        continue;
      }
    }

    try {
      const md = await fetchMarketDataWithFallback(normalizeTicker(ticker));
      if (md.error || md.price1 <= 0) continue;

      results[ticker] = md.price1;

      await supabase.from("price_cache").upsert(
        { cache_key: cacheKey, price: md.price1, fetched_at: now.toISOString(), ttl_seconds: 900 },
        { onConflict: "cache_key" },
      );
    } catch {
      /* skip on error */
    }
  }

  return NextResponse.json(results);
});
