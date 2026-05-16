import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getPortfolio } from "@/lib/services/portfolio";
import { explainHolding } from "@/lib/services/ai";
import { z } from "zod";
import { ASSET_CLASS_ENUM } from "@/lib/constants/asset-classes";

const ExplainSchema = z.object({
  portfolioId: z.string().uuid(),
  ticker: z.string().min(1).max(20),
  name: z.string().optional(),
  assetClass: ASSET_CLASS_ENUM,
  currentPrice: z.number(),
  quantity: z.number(),
  currentValue: z.number(),
  pctOfPortfolio: z.number(),
});

export const POST = withAuth(async (req, user, _ctx) => {
  const body = await req.json();
  const parsed = ExplainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const portfolio = await getPortfolio(parsed.data.portfolioId);
  if (!portfolio || portfolio.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const explanation = await explainHolding({
    ticker: parsed.data.ticker,
    name: parsed.data.name ?? null,
    assetClass: parsed.data.assetClass,
    currentPrice: parsed.data.currentPrice,
    quantity: parsed.data.quantity,
    currentValue: parsed.data.currentValue,
    pctOfPortfolio: parsed.data.pctOfPortfolio,
  });
  return NextResponse.json({ explanation });
});
