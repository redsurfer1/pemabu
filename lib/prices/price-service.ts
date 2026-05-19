import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchMarketDataWithFallback, normalizeTicker } from "@/lib/market-data/fetch-market-data";

type PeriodKey = "3mo" | "6mo" | "1yr" | "3yr" | "5yr";

const PERIOD_BASIS: Record<PeriodKey, "basisPrice3mo" | "basisPrice6mo" | "basisPrice1yr" | "basisPrice3yr" | "basisPrice5yr"> = {
  "3mo": "basisPrice3mo",
  "6mo": "basisPrice6mo",
  "1yr": "basisPrice1yr",
  "3yr": "basisPrice3yr",
  "5yr": "basisPrice5yr",
};

export type CurrentPrices = Record<string, number>;
export type HistoricalPrices = Record<string, Record<PeriodKey, number>>;

async function resolveCurrentPrices(
  tickers: string[],
  now: Date,
): Promise<CurrentPrices> {
  const cacheKeys = tickers.map((t) => `current:${t}`);
  const { data: cachedRows } = await supabaseAdmin
    .from("price_cache")
    .select("cache_key, price, fetched_at, ttl_seconds")
    .in("cache_key", cacheKeys);

  const cacheMap = new Map((cachedRows ?? []).map((r) => [String(r.cache_key), r]));
  const freshKeys = new Set<string>();
  const results: CurrentPrices = {};

  for (const ticker of tickers) {
    if (ticker === "CASH") { results[ticker] = 1; freshKeys.add(`current:CASH`); continue; }
    const cached = cacheMap.get(`current:${ticker}`);
    if (cached) {
      const expiresAt = new Date(new Date(cached.fetched_at).getTime() + cached.ttl_seconds * 1000);
      if (expiresAt > now) {
        results[ticker] = Number(cached.price);
        freshKeys.add(`current:${ticker}`);
      }
    }
  }

  const needsFetch = tickers.filter((t) => t !== "CASH" && !freshKeys.has(`current:${t}`));
  const fetchResults = await Promise.allSettled(
    needsFetch.map(async (ticker) => {
      const md = await fetchMarketDataWithFallback(normalizeTicker(ticker));
      if (md.error || md.price1 <= 0) return null;
      await supabaseAdmin.from("price_cache").upsert(
        { cache_key: `current:${ticker}`, price: md.price1, fetched_at: now.toISOString(), ttl_seconds: 900 },
        { onConflict: "cache_key" },
      );
      return { ticker, price: md.price1 };
    }),
  );

  for (const r of fetchResults) {
    if (r.status === "fulfilled" && r.value) results[r.value.ticker] = r.value.price;
  }
  return results;
}

async function resolveHistoricalPrices(
  tickers: string[],
  periods: PeriodKey[],
  now: Date,
): Promise<HistoricalPrices> {
  const dateKey = now.toISOString().slice(0, 10);
  const allCacheKeys = tickers.flatMap((t) =>
    t === "CASH" ? [] : periods.map((p) => `hist:${t}:${p}:${dateKey}`),
  );

  const results: HistoricalPrices = {};
  for (const t of tickers) results[t] = {} as Record<PeriodKey, number>;
  if (tickers.includes("CASH")) {
    for (const p of periods) results["CASH"]![p] = 1;
  }

  const { data: cachedRows } =
    allCacheKeys.length > 0
      ? await supabaseAdmin.from("price_cache").select("cache_key, price, fetched_at, ttl_seconds").in("cache_key", allCacheKeys)
      : { data: [] };

  const cacheMap = new Map((cachedRows ?? []).map((r) => [String(r.cache_key), r]));
  const freshKeys = new Set<string>();

  for (const t of tickers) {
    if (t === "CASH") continue;
    for (const p of periods) {
      const ck = `hist:${t}:${p}:${dateKey}`;
      const cached = cacheMap.get(ck);
      if (cached) {
        const expiresAt = new Date(new Date(cached.fetched_at).getTime() + cached.ttl_seconds * 1000);
        if (expiresAt > now) {
          results[t]![p] = Number(cached.price);
          freshKeys.add(ck);
        }
      }
    }
  }

  const needsFetch = tickers.filter((t) => t !== "CASH");
  const fetchResults = await Promise.allSettled(
    needsFetch.map(async (ticker) => {
      const md = await fetchMarketDataWithFallback(normalizeTicker(ticker));
      if (md.error) return { ticker, found: [] as Array<{ period: PeriodKey; price: number }> };
      const found: Array<{ period: PeriodKey; price: number }> = [];
      for (const p of periods) {
        if (freshKeys.has(`hist:${ticker}:${p}:${dateKey}`)) continue;
        const price = md[PERIOD_BASIS[p]];
        if (price > 0) {
          found.push({ period: p, price });
          await supabaseAdmin.from("price_cache").upsert(
            { cache_key: `hist:${ticker}:${p}:${dateKey}`, price, fetched_at: now.toISOString(), ttl_seconds: 86400 },
            { onConflict: "cache_key" },
          );
        }
      }
      return { ticker, found };
    }),
  );

  for (const r of fetchResults) {
    if (r.status === "fulfilled") {
      for (const f of r.value.found) results[r.value.ticker]![f.period] = f.price;
    }
  }
  return results;
}

export async function resolvePrices(
  tickers: string[],
  options?: { periods?: PeriodKey[] },
): Promise<{ current: CurrentPrices; historical: HistoricalPrices }> {
  const now = new Date();
  const periods = options?.periods ?? ["3mo", "6mo", "1yr", "3yr", "5yr"];
  const [current, historical] = await Promise.all([
    resolveCurrentPrices(tickers, now),
    resolveHistoricalPrices(tickers, periods, now),
  ]);
  return { current, historical };
}
