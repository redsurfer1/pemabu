import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { getConsolidatedDashboard, getUserPortfolios, getPortfolioHoldings } from "@/lib/services/portfolio";
import { getActiveProvider } from "@/lib/market-data";
import type { Quote as MarketQuote } from "@/lib/market-data/types";
import type { Quote as EngineQuote } from "@/lib/allocation/asset-class-utils";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { canUseExchangePriceSync } from "@/lib/entitlements/tier-capabilities";
import { tierForbiddenResponse } from "@/lib/security/tier-guard";

const DASHBOARD_COMPUTE_TIMEOUT_MS = 15_000;

function marketQuoteToEngine(q: MarketQuote): EngineQuote {
  return {
    ticker: q.ticker,
    price: q.price,
    currency: q.currency,
    asOf: q.asOf,
    source: q.source,
  };
}

async function computeDashboard(userId: string) {
  const portfolios = await getUserPortfolios(userId);
  const allHoldings = (await Promise.all(portfolios.map((p) => getPortfolioHoldings(p.id)))).flat();

  const tickers = [
    ...new Set(
      allHoldings
        .map((h) => h.ticker)
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0),
    ),
  ];

  const quotesMap = new Map<string, EngineQuote>();
  if (tickers.length > 0) {
    const provider = getActiveProvider();
    const result = await provider.getQuotes(tickers);
    for (const q of result.quotes) {
      if (q) quotesMap.set(q.ticker, marketQuoteToEngine(q));
    }
  }

  const dashboard = await getConsolidatedDashboard(userId, quotesMap);
  return dashboard;
}

export const GET = withAuth(async (req, user, _ctx) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!canUseExchangePriceSync(keys)) return tierForbiddenResponse("INTELLIGENCE");

  try {
    const result = await Promise.race([
      computeDashboard(user.id),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Dashboard timeout after ${DASHBOARD_COMPUTE_TIMEOUT_MS / 1000}s`)),
          DASHBOARD_COMPUTE_TIMEOUT_MS,
        ),
      ),
    ]);
    return NextResponse.json(result);
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : String(e);
    console.error("GET /api/workbook/consolidated:", msg, e);
    const status = /timeout/i.test(msg) ? 504 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}, { keyTemplate: "consolidated:{userId}", ...READ_RATE_LIMIT });
