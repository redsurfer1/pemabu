import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { alertOperator } from "@/lib/services/email";

function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);

    const { data: rows, error } = await supabaseAdmin
      .from("portfolio_holdings")
      .select("ticker, portfolio_id, last_price_refreshed_at");

    if (error) throw error;

    const staleHoldings = (rows ?? []).filter((h) => {
      if (h.last_price_refreshed_at == null) return true;
      return new Date(h.last_price_refreshed_at as string) < cutoff;
    });

    if (staleHoldings.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All holdings refreshed within 48h",
      });
    }

    const byPortfolio = new Map<string, string[]>();
    for (const h of staleHoldings) {
      const pid = h.portfolio_id as string;
      const ticker = h.ticker as string;
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
      notified: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertOperator("Assumption drift check FAILED", `Error: ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
