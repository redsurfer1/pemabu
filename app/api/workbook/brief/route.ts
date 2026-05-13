import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getPortfolio, getPortfolioHoldings, getPortfolioSignals } from "@/lib/services/portfolio";
import { generatePortfolioBrief } from "@/lib/services/ai";
import { getActiveProvider } from "@/lib/market-data";
import { calculateAllocationWeights, calculatePortfolioValue, DEFAULT_TARGETS } from "@/lib/allocation/engine";
import { z } from "zod";
import type { Quote as MarketQuote } from "@/lib/market-data/types";
import type { Quote as EngineQuote } from "@/lib/allocation/engine";

const BriefSchema = z.object({
  portfolioId: z.string().uuid(),
});

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

export const POST = withAuth(async (req, user, _ctx) => {
  const body = await req.json();
  const parsed = BriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { getActiveServiceKeysForUser } = await import("@/lib/services/user-entitlements");
  const { requireIntelligenceTier } = await import("@/lib/portfolio/intelligence-access");
  const keys = await getActiveServiceKeysForUser(user.id);
  const tierBlock = requireIntelligenceTier(keys);
  if (tierBlock) return tierBlock;

  const portfolio = await getPortfolio(parsed.data.portfolioId);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const holdings = await getPortfolioHoldings(parsed.data.portfolioId);
  const tickers = holdings.map((h) => h.ticker);
  let quotesMap = new Map<string, EngineQuote>();
  if (tickers.length > 0) {
    const provider = getActiveProvider();
    const result = await provider.getQuotes(tickers);
    quotesMap = toEngineQuotesMap(result.quotes);
  }
  const weights = calculateAllocationWeights(holdings, quotesMap, DEFAULT_TARGETS);
  const totalValue = calculatePortfolioValue(holdings, quotesMap);
  const recentSignals = await getPortfolioSignals(parsed.data.portfolioId, {
    status: "unacknowledged",
    limit: 5,
  });
  const brief = await generatePortfolioBrief({
    portfolioName: portfolio.name,
    totalValue,
    currency: portfolio.currency,
    weights,
    recentSignals,
  });
  return NextResponse.json({ brief });
});
