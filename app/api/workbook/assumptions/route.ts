import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { assertPortfolioOwnedByUser, getPortfolioAssumptions, upsertPortfolioAssumptions } from "@/lib/portfolio/portfolio-assumptions-store";
import type { Assumptions } from "@/lib/portfolio/formula-engine";
const AssumptionsBodySchema = z.object({
  portfolioId: z.string().uuid(),
  return_weights: z
    .object({
      r3mo: z.number(),
      r6mo: z.number(),
      r1yr: z.number(),
      r3yr: z.number(),
      r5yr: z.number(),
    })
    .optional(),
  factor_weights: z.record(z.string(), z.number()).optional(),
});

export const GET = withAuth(async (req, user) => {
  const portfolioId = new URL(req.url).searchParams.get("portfolioId");
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }
  if (!(await assertPortfolioOwnedByUser(portfolioId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const assumptions = await getPortfolioAssumptions(portfolioId);
  return NextResponse.json({ assumptions });
});

export const PUT = withAuth(async (req, user) => {
  const body = await req.json();
  const parsed = AssumptionsBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { portfolioId } = parsed.data;
  if (!(await assertPortfolioOwnedByUser(portfolioId, user.id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await getPortfolioAssumptions(portfolioId);
  const merged: Assumptions = {
    return_weights: parsed.data.return_weights ?? existing.return_weights,
    factor_weights: {
      ...existing.factor_weights,
      ...(parsed.data.factor_weights ?? {}),
    },
  };

  const applied = await upsertPortfolioAssumptions(portfolioId, merged);
  return NextResponse.json({ assumptions: applied });
});
