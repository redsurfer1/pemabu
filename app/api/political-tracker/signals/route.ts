import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getPortfolioTickersForUser } from "@/lib/portfolio/portfolio-tickers";
import { enrichDisclosuresWithSentiment } from "@/lib/political-tracker/disclosure-sentiment";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DISPLAY_DAYS = 90;
const HISTORY_DAYS = 365;

// Returns congressional disclosures that overlap with the user's portfolio holdings.
export const GET = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, "addon_political_tracker");

  const url = new URL(req.url);
  const portfolioId = url.searchParams.get("portfolio_id");
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolio_id is required" }, { status: 400 });
  }

  const { data: portfolio } = await supabaseAdmin
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const tickers = await getPortfolioTickersForUser(user.id, { portfolioId });

  if (tickers.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  const displaySince = new Date();
  displaySince.setDate(displaySince.getDate() - DISPLAY_DAYS);
  const displaySinceStr = displaySince.toISOString().split("T")[0]!;

  const historySince = new Date();
  historySince.setDate(historySince.getDate() - HISTORY_DAYS);
  const historySinceStr = historySince.toISOString().split("T")[0]!;

  const { data: history, error } = await supabaseAdmin
    .from("congressional_disclosures")
    .select("*")
    .in("ticker", tickers)
    .gte("transaction_date", historySinceStr)
    .order("transaction_date", { ascending: false })
    .limit(500);

  if (error) {
    console.error("political-tracker/signals:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all = history ?? [];
  const recent = all.filter((r) => String(r.transaction_date) >= displaySinceStr).slice(0, 100);
  const signals = enrichDisclosuresWithSentiment(all, recent);

  return NextResponse.json({
    signals,
    portfolio_id: portfolioId,
    tickers,
  });
});
