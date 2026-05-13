import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getUserPortfolios, createPortfolio } from "@/lib/services/portfolio";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier, tierForbiddenResponse } from "@/lib/security/tier-guard";
import { maxPortfoliosForTier } from "@/lib/entitlements/tier-capabilities";
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

  const existing = await getUserPortfolios(user.id);
  const keys = await getActiveServiceKeysForUser(user.id);
  const tier = resolveEffectiveTier(keys);
  if (existing.length >= maxPortfoliosForTier(tier)) {
    return tierForbiddenResponse("INTELLIGENCE");
  }

  const portfolio = await createPortfolio(user.id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    currency: parsed.data.currency,
  });
  return NextResponse.json({ portfolio }, { status: 201 });
});
