import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { seedDemoPortfolioForUser } from "@/lib/demo/seed-demo-portfolio";
import type { PortfolioType } from "@/lib/demo/seed-demo-portfolio";

/**
 * POST — auto-onboard a first-time user:
 * Seed a demo portfolio if none exists.
 */
export const POST = withAuth(async (req, user) => {
  let portfolioType: PortfolioType = "balanced";
  try {
    const body = await req.json();
    if (body.portfolioType === "growth" || body.portfolioType === "balanced" || body.portfolioType === "income") {
      portfolioType = body.portfolioType;
    }
  } catch {
    // no body or invalid json — use default
  }

  const result = await seedDemoPortfolioForUser(user.id, portfolioType);

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to create demo portfolio" }, { status: 500 });
  }

  return NextResponse.json({
    portfolioId: result.portfolioId,
    holdingsCount: result.holdingsCount,
    created: result.created,
  });
}, { keyTemplate: "auto-onboard:{userId}", ...MUTATION_RATE_LIMIT });
