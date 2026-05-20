import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withAuth } from "@/lib/api/auth";
import { getPortfolio, getPortfolioHoldings, getPortfolioSignals } from "@/lib/services/portfolio";
import { generatePortfolioBrief } from "@/lib/services/ai";
import { getActiveProvider } from "@/lib/market-data";
import { calculateAllocationWeights, calculatePortfolioValue, DEFAULT_TARGETS } from "@/lib/allocation/asset-class-utils";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, BRIEF_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { z } from "zod";
import type { Quote as MarketQuote } from "@/lib/market-data/types";
import type { Quote as EngineQuote } from "@/lib/allocation/asset-class-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

const BRIEF_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const BriefSchema = z.object({
  portfolioId: z.string().uuid(),
});

async function fetchLatestCachedBrief(
  supabase: SupabaseClient,
  portfolioId: string,
  userId: string,
): Promise<{ brief_text: string; generated_at: string } | null> {
  const { data } = await supabase
    .from("portfolio_briefs")
    .select("brief_text, generated_at")
    .eq("portfolio_id", portfolioId)
    .eq("user_id", userId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

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

export const GET = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const portfolioId = url.searchParams.get("portfolioId");
  if (!portfolioId) {
    return NextResponse.json({ error: "Missing portfolioId" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: lastBrief } = await supabase
    .from("portfolio_briefs")
    .select("brief_text, generated_at")
    .eq("portfolio_id", portfolioId)
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastBrief) {
    return NextResponse.json({ error: "No brief found" }, { status: 404 });
  }

  const ageMs = Date.now() - new Date(lastBrief.generated_at).getTime();
  const nextAvailableMs = Math.max(0, 24 * 60 * 60 * 1000 - ageMs);

  return NextResponse.json({
    brief: lastBrief.brief_text,
    cached: ageMs < 24 * 60 * 60 * 1000,
    nextAvailableMs,
    generatedAt: lastBrief.generated_at,
  });
});

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

  // Rate limit: 3 briefs per user per 24 hours (Supabase-backed)
  const rl = await checkRateLimit({ key: `brief:${user.id}`, ...BRIEF_RATE_LIMIT });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Daily brief limit reached (3 per 24 hours). Try again later.",
        code: "RATE_LIMITED",
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  const portfolio = await getPortfolio(parsed.data.portfolioId);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();

  // ── 24-hour cooldown check ──────────────────────────────────────────────────
  const lastBrief = await fetchLatestCachedBrief(
    supabase,
    parsed.data.portfolioId,
    user.id,
  );

  if (lastBrief) {
    const ageMs = Date.now() - new Date(lastBrief.generated_at).getTime();
    if (ageMs < BRIEF_COOLDOWN_MS) {
      const nextAvailableMs = BRIEF_COOLDOWN_MS - ageMs;
      return NextResponse.json(
        {
          brief: lastBrief.brief_text,
          cached: true,
          nextAvailableMs,
          message: "Brief generated within the last 24 hours. Returning cached version.",
        },
        { status: 200 },
      );
    }
  }

  // ── Generate fresh brief ────────────────────────────────────────────────────
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

  let brief: string;
  let cached = false;
  let degraded = false;

  try {
    brief = await generatePortfolioBrief({
      portfolioName: portfolio.name,
      totalValue,
      currency: portfolio.currency,
      weights,
      recentSignals,
      userId: user.id,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: "portfolio_brief", fallback: "cache" } });
    console.warn("Portfolio brief generation failed, using cached fallback:", err);

    const fallback = await fetchLatestCachedBrief(supabase, parsed.data.portfolioId, user.id);
    if (!fallback) {
      return NextResponse.json(
        {
          error: "Brief generation is temporarily unavailable. Please try again later.",
          code: "BRIEF_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    brief = fallback.brief_text;
    cached = true;
    degraded = true;
  }

  if (!degraded) {
    const { error: insertError } = await supabase.from("portfolio_briefs").insert({
      portfolio_id: parsed.data.portfolioId,
      user_id: user.id,
      brief_text: brief,
    });

    if (insertError) {
      console.warn("portfolio_briefs insert failed:", insertError.message);
    }
  }

  return NextResponse.json({
    brief,
    cached,
    degraded,
    ...(degraded
      ? { message: "AI brief unavailable. Showing your most recent saved brief." }
      : {}),
  });
});
