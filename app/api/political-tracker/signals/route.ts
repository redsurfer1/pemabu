import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Returns congressional disclosures that overlap with the user's portfolio holdings.
// Requires addon_political_tracker OR intelligence_annual / autonomous_annual.
export const GET = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, "addon_political_tracker");

  const url = new URL(req.url);
  const portfolioId = url.searchParams.get("portfolio_id");
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolio_id is required" }, { status: 400 });
  }

  // Verify the user owns this portfolio.
  const { data: portfolio } = await supabaseAdmin
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  // Get all tickers held in this portfolio.
  const { data: holdings } = await supabaseAdmin
    .from("holdings")
    .select("ticker")
    .eq("portfolio_id", portfolioId);

  const tickers = (holdings ?? []).map((h) => (h as { ticker: string }).ticker.toUpperCase());

  if (tickers.length === 0) {
    return NextResponse.json({ signals: [] });
  }

  // Find disclosures in the last 90 days for those tickers.
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data, error } = await supabaseAdmin
    .from("congressional_disclosures")
    .select("*")
    .in("ticker", tickers)
    .gte("transaction_date", since.toISOString().split("T")[0])
    .order("transaction_date", { ascending: false })
    .limit(100);

  if (error) {
    console.error("political-tracker/signals:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ signals: data ?? [], portfolio_id: portfolioId, tickers });
});
