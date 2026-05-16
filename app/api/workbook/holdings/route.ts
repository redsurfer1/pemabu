import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { enrichHoldingsWithLiveQuotes } from "@/lib/market-data/enrich-holdings";
import { getPortfolioHoldings, getPortfolio, upsertHolding } from "@/lib/services/portfolio";
import { z } from "zod";

const UpsertHoldingSchema = z.object({
  portfolio_id: z.string().uuid(),
  ticker: z.string().min(1).max(20).toUpperCase(),
  name: z.string().max(200).optional(),
  asset_class: z.enum(["equity", "fixed_income", "alternatives", "cash", "crypto", "other"]),
  quantity: z.number().positive(),
  cost_basis: z.number().positive().optional(),
  currency: z.enum(["USD", "GBP", "EUR", "CAD", "AUD"]).default("USD"),
  source: z.enum(["manual", "upload", "csv_import"]).default("manual"),
  expense_ratio: z.number().min(0).max(1).optional(),
  target_weight_pct: z.number().min(0).max(100).optional(),
});

export const GET = withAuth(async (req, user, _ctx) => {
  const url = new URL(req.url);
  const portfolioId = url.searchParams.get("portfolioId");
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }
  const portfolio = await getPortfolio(portfolioId);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const holdings = await enrichHoldingsWithLiveQuotes(await getPortfolioHoldings(portfolioId));
  return NextResponse.json({ holdings });
});

export const POST = withAuth(async (req, user, _ctx) => {
  const body = await req.json();
  const parsed = UpsertHoldingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const holdingData = { ...parsed.data };
  if (holdingData.asset_class === "cash") {
    holdingData.ticker = "CASH";
  }

  const portfolio = await getPortfolio(holdingData.portfolio_id);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { portfolio_id, name, cost_basis, expense_ratio, target_weight_pct, ...rest } = holdingData;
  try {
    const holding = await upsertHolding(portfolio_id, {
      ...rest,
      name: name ?? null,
      cost_basis: cost_basis ?? null,
      ...(expense_ratio !== undefined ? { expense_ratio } : {}),
      ...(target_weight_pct !== undefined ? { target_weight_pct } : {}),
    });
    return NextResponse.json({ holding }, { status: 201 });
  } catch (e: unknown) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : String(e);
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : undefined;
    const details =
      e && typeof e === "object" && "details" in e ? (e as { details: string }).details : undefined;
    const hint =
      e && typeof e === "object" && "hint" in e ? (e as { hint: string }).hint : undefined;
    console.error("POST /api/workbook/holdings:", msg, code, details, hint);
    return NextResponse.json(
      { error: msg, code, details, hint },
      { status: code === "PGRST116" ? 404 : 422 },
    );
  }
});
