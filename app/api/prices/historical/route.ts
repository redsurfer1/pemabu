import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchMarketDataWithFallback } from "@/lib/market-data/fetch-market-data";
import { normalizeTicker } from "@/lib/market-data/normalize-ticker";

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

export const GET = withAuth(async (request, _user, _ctx) => {
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

  for (const ticker of tickers) {
    results[ticker] = {};

    if (ticker === "CASH") {
      for (const period of periods) {
        if (period in PERIOD_BASIS) results[ticker]![period] = 1;
      }
      continue;
    }

    let md: Awaited<ReturnType<typeof fetchMarketDataWithFallback>> | null = null;

    for (const period of periods) {
      if (!(period in PERIOD_BASIS)) continue;

      const cacheKey = `hist:${ticker}:${period}:${dateKey}`;

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

      if (!md) {
        try {
          md = await fetchMarketDataWithFallback(normalizeTicker(ticker));
        } catch {
          md = null;
        }
      }

      const basisKey = PERIOD_BASIS[period];
      const price = md && !md.error ? md[basisKey] : 0;
      if (price > 0) {
        results[ticker]![period] = price;
        await supabase.from("price_cache").upsert(
          { cache_key: cacheKey, price, fetched_at: new Date().toISOString(), ttl_seconds: 86400 },
          { onConflict: "cache_key" },
        );
      }
    }
  }

  return NextResponse.json(results);
});
