import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveProvider } from "@/lib/market-data";
import { alertOperator, sendWeeklyBrief } from "@/lib/services/email";
import { generatePortfolioBrief } from "@/lib/services/ai";
import {
  calculateAllocationWeights,
  calculatePortfolioValue,
  DEFAULT_TARGETS,
  type Quote as EngineQuote,
} from "@/lib/allocation/engine";
import type { Quote as MarketQuote } from "@/lib/market-data/types";
import type { Holding, Portfolio, Signal } from "@/lib/types/database";

function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
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

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  const errors: string[] = [];

  try {
    const { data: portfolios, error: pErr } = await supabaseAdmin.from("portfolios").select("*");

    if (pErr) throw pErr;
    if (!portfolios || portfolios.length === 0) {
      return NextResponse.json({ success: true, log: ["No portfolios to brief"] });
    }

    const provider = getActiveProvider();

    for (const portfolio of portfolios as Portfolio[]) {
      try {
        const { data: holdings, error: hErr } = await supabaseAdmin
          .from("portfolio_holdings")
          .select("*")
          .eq("portfolio_id", portfolio.id);

        if (hErr) throw hErr;
        if (!holdings || holdings.length === 0) {
          log.push(`${portfolio.name}: skipped (no holdings)`);
          continue;
        }

        const holdingRows = holdings as Holding[];
        const tickers = [...new Set(holdingRows.map((h) => h.ticker).filter((t) => t?.trim()))];
        if (tickers.length === 0) {
          log.push(`${portfolio.name}: skipped (no tickers)`);
          continue;
        }

        const result = await provider.getQuotes(tickers);
        const quotesMap = toEngineQuotesMap(result.quotes);

        const weights = calculateAllocationWeights(holdingRows, quotesMap, DEFAULT_TARGETS);
        const totalValue = calculatePortfolioValue(holdingRows, quotesMap);

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const { data: recentSignals, error: sErr } = await supabaseAdmin
          .from("signals")
          .select("*")
          .eq("portfolio_id", portfolio.id)
          .eq("status", "unacknowledged")
          .neq("type", "brief")
          .gte("created_at", weekAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(10);

        if (sErr) throw sErr;

        const briefText = await generatePortfolioBrief({
          portfolioName: portfolio.name,
          totalValue,
          currency: portfolio.currency,
          weights,
          recentSignals: (recentSignals ?? []) as Signal[],
        });

        const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(portfolio.user_id);
        if (userErr) {
          errors.push(`${portfolio.name}: auth lookup ${userErr.message}`);
          continue;
        }

        const ownerEmail = userData.user?.email;
        if (!ownerEmail) {
          errors.push(`${portfolio.name}: no owner email found`);
          continue;
        }

        await sendWeeklyBrief({
          toEmail: ownerEmail,
          portfolioName: portfolio.name,
          briefText,
        });

        const now = new Date().toISOString();
        await supabaseAdmin.from("signals").insert({
          portfolio_id: portfolio.id,
          type: "brief",
          severity: "info",
          status: "acknowledged",
          title: "Weekly portfolio brief",
          message: briefText.slice(0, 200),
          acknowledged_at: now,
          metadata: {
            full_brief: briefText,
            sent_to: ownerEmail,
          } as Record<string, unknown>,
        });

        log.push(`${portfolio.name}: brief sent`);
      } catch (portfolioErr) {
        const msg = portfolioErr instanceof Error ? portfolioErr.message : String(portfolioErr);
        errors.push(`${portfolio.name}: ${msg}`);
      }
    }

    if (errors.length > 0) {
      await alertOperator(
        "Weekly brief: some portfolios failed",
        `Errors:\n${errors.join("\n")}\n\nLog:\n${log.join("\n")}`,
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, log, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertOperator("Weekly brief FAILED", `Error: ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
