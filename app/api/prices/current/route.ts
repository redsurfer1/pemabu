import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPrices } from "@/lib/prices/priceService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");

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
  const results = await getCurrentPrices(supabase, tickers);

  return NextResponse.json(results);
}
