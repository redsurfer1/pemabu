import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT, MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { getPortfolio } from "@/lib/services/portfolio";
import { createClient } from "@/lib/supabase/server";
import { ROW_STATUS } from "@/lib/portfolio/fiat-watchlist";
import { z } from "zod";

const WatchlistSchema = z.object({
  portfolio_id: z.string().uuid(),
  ticker: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  name: z.string().max(200).optional(),
});

export const GET = withAuth(async (req, user) => {
  const portfolioId = new URL(req.url).searchParams.get("portfolioId");
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  const portfolio = await getPortfolio(portfolioId);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select("id, portfolio_id, ticker, name, currency, row_status, quantity, created_at, updated_at")
    .eq("portfolio_id", portfolioId)
    .eq("row_status", ROW_STATUS.WATCH)
    .order("ticker", { ascending: true });

  if (error) throw error;
  return NextResponse.json({ watchList: data ?? [] });
}, { keyTemplate: "watchlist:{userId}", ...READ_RATE_LIMIT });

export const POST = withAuth(async (req, user) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = WatchlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const portfolio = await getPortfolio(parsed.data.portfolio_id);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ticker = parsed.data.ticker === "CASH" ? "CASH" : parsed.data.ticker;
  const assetClass = ticker === "CASH" || ticker === "USD" ? "cash" : "equity";

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("portfolio_holdings")
    .select("id, quantity, row_status")
    .eq("portfolio_id", parsed.data.portfolio_id)
    .eq("ticker", ticker)
    .maybeSingle();

  const quantity =
    existing?.row_status === ROW_STATUS.ACTIVE && Number(existing.quantity) > 0
      ? Number(existing.quantity)
      : 0;

  const { data, error } = await supabase
    .from("portfolio_holdings")
    .upsert(
      {
        portfolio_id: parsed.data.portfolio_id,
        ticker,
        name: parsed.data.name ?? ticker,
        asset_class: assetClass,
        quantity,
        currency: "USD",
        source: "manual",
        row_status: ROW_STATUS.WATCH,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "portfolio_id,ticker" },
    )
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ watch: data }, { status: 201 });
}, { keyTemplate: "watchlist:{userId}", ...MUTATION_RATE_LIMIT });
