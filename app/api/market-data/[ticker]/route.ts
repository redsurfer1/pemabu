import { NextResponse } from "next/server";
import { fetchMarketDataWithFallback } from "@/lib/market-data/yahoo-finance";

// TODO: add Redis rate limit before production
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticker?: string | string[] }> },
) {
  const params = await ctx.params;
  const tickerRaw = Array.isArray(params.ticker) ? params.ticker[0] : params.ticker;
  const ticker = tickerRaw?.trim();

  if (!ticker) {
    return NextResponse.json({ error: "Ticker required" }, { status: 404 });
  }

  const data = await fetchMarketDataWithFallback(ticker);
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
}
