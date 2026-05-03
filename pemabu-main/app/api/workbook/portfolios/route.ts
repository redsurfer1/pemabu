import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getUserPortfolios, createPortfolio } from "@/lib/services/portfolio";
import { z } from "zod";

const CreatePortfolioSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.enum(["USD", "GBP", "EUR", "CAD", "AUD"]).default("USD"),
});

export const GET = withAuth(async (req, user, _ctx) => {
  const portfolios = await getUserPortfolios(user.id);
  return NextResponse.json({ portfolios });
});

export const POST = withAuth(async (req, user, _ctx) => {
  const body = await req.json();
  const parsed = CreatePortfolioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const portfolio = await createPortfolio(user.id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    currency: parsed.data.currency,
  });
  return NextResponse.json({ portfolio }, { status: 201 });
});
