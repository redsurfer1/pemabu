import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";

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
    const cacheKey = `current:${ticker}`;

    // Check cache (15-min TTL for current prices)
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

    // Fetch from Yahoo Finance
    try {
      const yahooFinance = (await import("yahoo-finance2")).default;
      const quote = await yahooFinance.quote(ticker) as { regularMarketPrice?: number };
      const price = quote.regularMarketPrice;

      if (price != null) {
        results[ticker] = price;

        // Cache with 15-min TTL
        await supabase.from("price_cache").upsert(
          { cache_key: cacheKey, price, fetched_at: now.toISOString(), ttl_seconds: 900 },
          { onConflict: "cache_key" },
        );
      }
    } catch {
      // Skip on error
    }
  }

  return NextResponse.json(results);
});
