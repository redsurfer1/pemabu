import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { seedDemoPortfolioForUser } from "@/lib/demo/seed-demo-portfolio";

export const runtime = "nodejs";

/** POST — create or refresh the onboarding demo portfolio for the signed-in user. */
export const POST = withAuth(async (_req, user) => {
  const result = await seedDemoPortfolioForUser(user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({
    portfolioId: result.portfolioId,
    holdingsCount: result.holdingsCount,
    created: result.created,
  });
});
