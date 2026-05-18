import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchTiingoDailyCloses } from "@/lib/market-data/tiingo-daily-closes";
import { pearsonCorrelation } from "@/lib/intelligence/macro-regime";

function logReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1]!;
    const b = closes[i]!;
    if (a > 0 && b > 0) r.push(Math.log(b / a));
  }
  return r;
}

function alignReturns(a: number[], b: number[]): { ax: number[]; by: number[] } {
  const n = Math.min(a.length, b.length);
  if (n < 2) return { ax: [], by: [] };
  return { ax: a.slice(-n), by: b.slice(-n) };
}

const PROXY_TICKERS = ["SPY", "AGG", "BTC-USD", "GLD"] as const;

/**
 * Refreshes shared correlation rows using aligned daily log-returns from Tiingo.
 */
export async function refreshMacroCorrelationCache(
  admin: SupabaseClient,
): Promise<void> {
  const series: Record<string, number[]> = {};
  for (const t of PROXY_TICKERS) {
    const closes = await fetchTiingoDailyCloses(t);
    series[t] = logReturns(closes);
  }

  const pairs: [string, string][] = [
    ["SPY", "AGG"],
    ["SPY", "BTC-USD"],
    ["SPY", "GLD"],
    ["AGG", "BTC-USD"],
    ["AGG", "GLD"],
    ["BTC-USD", "GLD"],
  ];

  const now = new Date().toISOString();

  for (const [x, y] of pairs) {
    const { ax, by } = alignReturns(series[x] ?? [], series[y] ?? []);
    if (ax.length < 10) continue;
    const r90 = pearsonCorrelation(ax, by);
    const ax30 = ax.slice(-30);
    const by30 = by.slice(-30);
    const r30 = ax30.length >= 5 ? pearsonCorrelation(ax30, by30) : null;

    const asset_pair = `${x}:${y}`;
    const { error } = await admin.from("macro_correlation_cache").upsert(
      {
        asset_pair,
        correlation_30d: r30,
        correlation_90d: r90,
        computed_at: now,
      },
      { onConflict: "asset_pair" },
    );
    if (error) console.error("macro_correlation_cache upsert:", error.message);
  }
}
