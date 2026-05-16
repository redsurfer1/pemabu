import type { Holding } from "@/lib/types/database";
import { getActiveProvider } from "./index";

/** Fill missing current_price / last_change_pct from the active market-data provider (display-only). */
export async function enrichHoldingsWithLiveQuotes(holdings: Holding[]): Promise<Holding[]> {
  const tickers = [
    ...new Set(
      holdings
        .filter(
          (h) =>
            h.asset_class !== "cash" &&
            h.ticker !== "CASH" &&
            (h.current_price == null || !Number.isFinite(Number(h.current_price))),
        )
        .map((h) => h.ticker.trim().toUpperCase())
        .filter((t) => t.length > 0),
    ),
  ];

  if (tickers.length === 0) {
    return holdings.map((h) =>
      h.asset_class === "cash" || h.ticker === "CASH"
        ? { ...h, current_price: h.current_price ?? 1 }
        : h,
    );
  }

  const liveByTicker = new Map<string, { price: number; changePercent: number }>();
  try {
    const result = await getActiveProvider().getQuotes(tickers);
    for (const q of result.quotes) {
      if (q?.ticker) {
        liveByTicker.set(q.ticker.toUpperCase(), {
          price: q.price,
          changePercent: q.changePercent,
        });
      }
    }
  } catch (e) {
    console.warn("enrichHoldingsWithLiveQuotes:", e);
  }

  return holdings.map((h) => {
    if (h.asset_class === "cash" || h.ticker === "CASH") {
      return { ...h, current_price: h.current_price ?? 1 };
    }
    const live = liveByTicker.get(h.ticker.toUpperCase());
    if (!live) return h;
    return {
      ...h,
      current_price: h.current_price ?? live.price,
      last_change_pct: h.last_change_pct ?? live.changePercent,
    };
  });
}
