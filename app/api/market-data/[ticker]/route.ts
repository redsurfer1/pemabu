import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { fetchMarketDataWithFallback } from "@/lib/market-data/yahoo-finance";
import { normalizeTicker } from "@/lib/market-data/yahoo-finance";

export const GET = withAuth(
  async (
    _req,
    _user,
    ctx: { params: Promise<{ ticker?: string | string[] }> },
  ) => {
    const params = await ctx.params;
    const tickerRaw = Array.isArray(params.ticker) ? params.ticker[0] : params.ticker;
    const ticker = tickerRaw?.trim();

    if (!ticker) {
      return NextResponse.json({ error: "Ticker required" }, { status: 404 });
    }

    // Normalize crypto tickers (BTC → BTC-USD) before fetching
    const normalized = normalizeTicker(ticker);

    const data = await fetchMarketDataWithFallback(normalized);
    if (data.error) {
      return NextResponse.json(data, { status: 502 });
    }
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=300",
        "x-market-data-provider": data.provider,
      },
    });
  },
);
