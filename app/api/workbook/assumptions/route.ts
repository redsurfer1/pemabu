import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT, MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { getBaseUrl } from "@/lib/app-url";
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
  try {
    const portfolioId = new URL(req.url).searchParams.get("portfolioId");
    if (!portfolioId) {
      return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
    }
    if (!(await assertPortfolioOwnedByUser(portfolioId, user.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const assumptions = await getPortfolioAssumptions(portfolioId);
    return NextResponse.json({ assumptions });
  } catch (err) {
    console.error("GET /api/workbook/assumptions:", err);
    const message = err instanceof Error ? err.message : "Failed to load assumptions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { keyTemplate: "assumptions:{userId}", ...READ_RATE_LIMIT });

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

  // Fire-and-forget: trigger a signals refresh so composite ranks update
  // immediately after the user changes weights. Uses a dedicated internal API
  // key to bypass the ownership gate. scope=signals_only skips the
  // >15-holdings 202 gate. Failures are non-fatal and must not delay the
  // response. Skipped entirely when PEMABU_INTERNAL_API_KEY is not configured.
  void (async () => {
    const internalKey = process.env.PEMABU_INTERNAL_API_KEY;
    if (!internalKey) {
      console.warn("[assumptions PUT] PEMABU_INTERNAL_API_KEY not set — skipping fire-and-forget refresh");
      return;
    }
    try {
      const baseUrl = getBaseUrl();
      await fetch(`${baseUrl}/api/portfolio/${portfolioId}/refresh?scope=signals_only`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${internalKey}`,
        },
      });
    } catch (e) {
      console.warn("[assumptions PUT] fire-and-forget refresh failed (non-fatal):", e);
    }
  })();

  return NextResponse.json({ assumptions: applied });
}, { keyTemplate: "assumptions:{userId}", ...MUTATION_RATE_LIMIT });
