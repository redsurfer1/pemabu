import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generatePortfolioBrief } from "@/lib/services/ai";
import { getActiveProvider } from "@/lib/market-data";
import { calculateAllocationWeights, calculatePortfolioValue, DEFAULT_TARGETS } from "@/lib/allocation/engine";
import { withCronSentry } from "@/lib/monitoring/cron-sentry";
import { verifyCronRequest } from "@/lib/cron/verify";
import type { Quote as MarketQuote } from "@/lib/market-data/types";
import type { Quote as EngineQuote } from "@/lib/allocation/engine";
import type { Holding } from "@/lib/types/database";

function toEngineQuotesMap(quotes: MarketQuote[]): Map<string, EngineQuote> {
  const m = new Map<string, EngineQuote>();
  for (const q of quotes) {
    m.set(q.ticker, {
      ticker: q.ticker,
      price: q.price,
      currency: q.currency,
      asOf: q.asOf,
      source: q.source,
    });
  }
  return m;
}

const handler = async (req: Request) => {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{ portfolioId: string; status: string; error?: string }> = [];

  const { data: portfolios } = await supabaseAdmin
    .from("portfolios")
    .select("id, user_id, name, currency");

  if (!portfolios?.length) {
    return NextResponse.json({ success: true, results: [], message: "No portfolios found" });
  }

  for (const portfolio of portfolios) {
    try {
      const { data: holdings } = await supabaseAdmin
        .from("portfolio_holdings")
        .select("*")
        .eq("portfolio_id", portfolio.id);

      if (!holdings?.length) {
        results.push({ portfolioId: portfolio.id, status: "skipped", error: "No holdings" });
        continue;
      }

      const allHoldings = holdings as Holding[];
      const tickers = allHoldings.map((h) => h.ticker);
      const provider = getActiveProvider();
      const quoteResult = await provider.getQuotes(tickers);
      const quotesMap = toEngineQuotesMap(quoteResult.quotes);

      for (const h of allHoldings) {
        if (h.asset_class === "cash") {
          quotesMap.set(h.ticker, {
            ticker: h.ticker,
            price: 1.00,
            currency: "USD",
            asOf: new Date(),
            source: "fixed",
          });
        }
      }

      const weights = calculateAllocationWeights(allHoldings, quotesMap, DEFAULT_TARGETS);
      const totalValue = calculatePortfolioValue(allHoldings, quotesMap);

      const brief = await generatePortfolioBrief({
        portfolioName: portfolio.name,
        totalValue,
        currency: portfolio.currency ?? "USD",
        weights,
        recentSignals: [],
      });

      const { error: insertError } = await supabaseAdmin.from("portfolio_briefs").insert({
        portfolio_id: portfolio.id,
        user_id: portfolio.user_id,
        brief_text: brief,
      });

      results.push({
        portfolioId: portfolio.id,
        status: insertError ? "error" : "generated",
        error: insertError?.message,
      });
    } catch (err) {
      results.push({
        portfolioId: portfolio.id,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    total: portfolios.length,
    generated: results.filter((r) => r.status === "generated").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  });
};

export const GET = withCronSentry("morning-brief", handler);
