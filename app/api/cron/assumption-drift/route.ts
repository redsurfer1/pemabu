import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { alertOperator } from "@/lib/services/email";
import { withCronSentry } from "@/lib/monitoring/cron-sentry";
import { verifyCronRequest } from "@/lib/cron/verify";

const PAGE_SIZE = 500;

const handler = async (req: Request) => {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);

    const allRows: Array<{ ticker: string; portfolio_id: string; last_price_refreshed_at: string | null }> = [];
    let from = 0;
    let page: typeof allRows;
    do {
      const { data: rows, error } = await supabaseAdmin
        .from("portfolio_holdings")
        .select("ticker, portfolio_id, last_price_refreshed_at")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      page = (rows ?? []) as typeof allRows;
      allRows.push(...page);
      from += PAGE_SIZE;
    } while (page.length === PAGE_SIZE);

    const staleHoldings = allRows.filter((h) => {
      if (h.last_price_refreshed_at == null) return true;
      return new Date(h.last_price_refreshed_at) < cutoff;
    });

    if (staleHoldings.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All holdings refreshed within 48h",
      });
    }

    const byPortfolio = new Map<string, string[]>();
    for (const h of staleHoldings) {
      const pid = h.portfolio_id;
      const ticker = h.ticker;
      const existing = byPortfolio.get(pid) ?? [];
      byPortfolio.set(pid, [...existing, ticker]);
    }

    const lines = [...byPortfolio.entries()].map(
      ([pid, tickers]) => `Portfolio ${pid}: ${tickers.join(", ")}`,
    );

    await alertOperator(
      "Stale price data detected",
      `${staleHoldings.length} holdings have not been refreshed in 48+ hours:\n\n${lines.join("\n")}\n\nCheck nightly refresh cron logs on Vercel.`,
    );

    return NextResponse.json({
      success: true,
      stale_count: staleHoldings.length,
      total_holdings: allRows.length,
      notified: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertOperator("Assumption drift check FAILED", `Error: ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
};

export const GET = withCronSentry("assumption-drift", handler);
