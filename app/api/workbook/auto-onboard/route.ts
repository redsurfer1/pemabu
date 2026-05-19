import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { seedDemoPortfolioForUser } from "@/lib/demo/seed-demo-portfolio";

/**
 * POST — auto-onboard a first-time user:
 * Seed a demo portfolio if none exists.
 */
export const POST = withAuth(async (_req, user) => {
  const result = await seedDemoPortfolioForUser(user.id);

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to create demo portfolio" }, { status: 500 });
  }

  return NextResponse.json({
    portfolioId: result.portfolioId,
    holdingsCount: result.holdingsCount,
    created: result.created,
  });
});
