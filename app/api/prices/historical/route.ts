import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getHistoricalPrices,
  type HistoricalPeriod,
} from "@/lib/prices/priceService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  const periodsParam = searchParams.get("periods");

  if (!tickersParam) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase());
  const periods = (
    periodsParam?.split(",") ?? ["3mo", "6mo", "1yr", "3yr", "5yr"]
  ) as HistoricalPeriod[];

  const results = await getHistoricalPrices(supabase, tickers, periods);

  return NextResponse.json(results);
}
