import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getPortfolio } from "@/lib/services/portfolio";
import { createClient } from "@/lib/supabase/server";
import { ROW_STATUS } from "@/lib/portfolio/fiat-watchlist";

export const DELETE = withAuth(async (req, user, ctx) => {
  const { ticker: rawTicker } = await ctx.params;
  const tickerParam = Array.isArray(rawTicker) ? rawTicker[0] : rawTicker;
  if (!tickerParam) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }
  const ticker = decodeURIComponent(tickerParam).toUpperCase();
  const portfolioId = new URL(req.url).searchParams.get("portfolioId");

  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  const portfolio = await getPortfolio(portfolioId);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("portfolio_holdings")
    .select("id, quantity, row_status")
    .eq("portfolio_id", portfolioId)
    .eq("ticker", ticker)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) {
    return NextResponse.json({ success: true });
  }

  if (existing.row_status === ROW_STATUS.WATCH && Number(existing.quantity) === 0) {
    const { error: delErr } = await supabase.from("portfolio_holdings").delete().eq("id", existing.id);
    if (delErr) throw delErr;
    return NextResponse.json({ success: true });
  }

  const { error: updateErr } = await supabase
    .from("portfolio_holdings")
    .update({
      row_status: ROW_STATUS.ACTIVE,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (updateErr) throw updateErr;
  return NextResponse.json({ success: true });
});
