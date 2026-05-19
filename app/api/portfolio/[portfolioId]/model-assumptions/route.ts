import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type RouteHandlerContext } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT, READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import {
  getModelAssumptionsForPortfolioIfOwned,
  upsertModelAssumptions,
} from "@/lib/portfolio/model-assumptions-store";
import {
  DEFAULT_FACTOR_WEIGHTS,
  normaliseFactorWeights,
  sumFactorWeights,
  type FactorWeights,
} from "@/lib/portfolio/portfolio-factors";
import type { EngineAssumptions } from "@/types/allocation";

const SleeveTypeSchema = z.enum(["main", "income"]);

const EngineAssumptionsSchema = z.object({
  retWeight3mo: z.number(),
  retWeight6mo: z.number(),
  retWeight1yr: z.number(),
  retWeight3yr: z.number(),
  retWeight5yr: z.number(),
  factorWeights: z.record(z.string(), z.number()),
  incomeBudgetPct: z.number(),
  volCapMultiplier: z.number(),
  themeCapPct: z.number(),
});

function validateAssumptions(a: EngineAssumptions): string | null {
  const retSum =
    a.retWeight3mo + a.retWeight6mo + a.retWeight1yr + a.retWeight3yr + a.retWeight5yr;
  if (Math.abs(retSum - 1) > 0.001) {
    return `Return weights sum to ${retSum.toFixed(4)}, must equal 1.0`;
  }
  const factorSum = sumFactorWeights(a.factorWeights).toNumber();
  if (Math.abs(factorSum - 1) > 0.001) {
    return `Factor weights sum to ${factorSum.toFixed(4)}, must equal 1.0`;
  }
  return null;
}

export const GET = withAuth(async (_req, user, ctx: RouteHandlerContext) => {
  const params = await ctx.params;
  const portfolioIdRaw = params.portfolioId;
  const portfolioId = Array.isArray(portfolioIdRaw) ? portfolioIdRaw[0] : portfolioIdRaw;
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  const assumptions = await getModelAssumptionsForPortfolioIfOwned(portfolioId, user.id);
  if (!assumptions) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ assumptions });
}, { keyTemplate: "model-assumptions:{userId}", ...READ_RATE_LIMIT });

export const PUT = withAuth(async (req, user, ctx: RouteHandlerContext) => {
  const params = await ctx.params;
  const portfolioIdRaw = params.portfolioId;
  const portfolioId = Array.isArray(portfolioIdRaw) ? portfolioIdRaw[0] : portfolioIdRaw;
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  const body = await req.json();
  const sleeveType = SleeveTypeSchema.parse(body.sleeveType ?? "main");
  const parsed = EngineAssumptionsSchema.safeParse(body.assumptions);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const assumptions: EngineAssumptions = {
    ...parsed.data,
    factorWeights: normaliseFactorWeights({
      ...DEFAULT_FACTOR_WEIGHTS,
      ...(parsed.data.factorWeights as Partial<FactorWeights>),
    }),
  };

  const validationError = validateAssumptions(assumptions);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const owned = await getModelAssumptionsForPortfolioIfOwned(portfolioId, user.id);
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await upsertModelAssumptions(portfolioId, sleeveType, assumptions);
  return NextResponse.json({ success: true, sleeveType, assumptions });
}, { keyTemplate: "model-assumptions:{userId}", ...MUTATION_RATE_LIMIT });
