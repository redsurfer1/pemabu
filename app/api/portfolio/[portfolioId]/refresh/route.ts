import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { withAuth, type RouteHandlerContext } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { refreshPortfolioSignals } from "@/lib/allocation/refresh-portfolio-signals";
import { normaliseWeights, type Assumptions } from "@/lib/portfolio/formula-engine";
import { normaliseFactorWeights } from "@/lib/portfolio/portfolio-factors";
import { runSovereignScorePipeline } from "@/lib/portfolio/sovereign-score-pipeline";

export const maxDuration = 60;

async function executeRefresh(
  req: Request,
  portfolioId: string,
  supabase: SupabaseClient,
  options: { skipOwnership: boolean; user?: User },
): Promise<Response> {
  const { data: portfolio, error } = await supabase
    .from("portfolios")
    .select("id, user_id")
    .eq("id", portfolioId)
    .single();

  if (error || !portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!options.skipOwnership && options.user && portfolio.user_id !== options.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!options.skipOwnership && options.user) {
    const { getActiveServiceKeysForUser } = await import("@/lib/services/user-entitlements");
    const { canUseExchangePriceSync } = await import("@/lib/entitlements/tier-capabilities");
    const { tierForbiddenResponse } = await import("@/lib/security/tier-guard");
    const keys = await getActiveServiceKeysForUser(options.user.id);
    if (!canUseExchangePriceSync(keys)) return tierForbiddenResponse("INTELLIGENCE");
  }

  // TODO: replace 202 path with Supabase Edge Function queue
  // trigger once background job infrastructure is in place
  const { count: holdingCount, error: countError } = await supabase
    .from("portfolio_holdings")
    .select("id", { count: "exact", head: true })
    .eq("portfolio_id", portfolioId);
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  const count = holdingCount ?? 0;
  const forceRefresh = req.headers.get("x-pemabu-force-refresh") === "true";
  // scope=signals_only: fired by the assumptions PUT to refresh ranks after
  // weight changes. Bypass the 202 gate so even large portfolios get updated.
  const signalsOnly = new URL(req.url).searchParams.get("scope") === "signals_only";
  if (count > 15 && !forceRefresh && !signalsOnly) {
    return NextResponse.json(
      {
        queued: true,
        reason: `Portfolio has ${count} holdings. Refresh has been queued. Add header x-pemabu-force-refresh: true to override.`,
        holdingCount: count,
      },
      { status: 202 },
    );
  }

  try {
    let assumptionsBody: Partial<Assumptions> | null = null;
    try {
      assumptionsBody = (await req.json()) as Partial<Assumptions>;
    } catch {
      assumptionsBody = null;
    }

    if (assumptionsBody) {
      const returnWeights = assumptionsBody.return_weights;
      const factorWeights = assumptionsBody.factor_weights;

      if (returnWeights) {
        const sum = Object.values(returnWeights).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1) > 0.001) {
          assumptionsBody.return_weights = normaliseWeights(returnWeights);
          console.warn("Portfolio refresh: auto-normalised return weights", {
            portfolioId,
            beforeSum: sum,
          });
        }
      }

      if (factorWeights) {
        const factorValues = Object.values(factorWeights);
        if (factorValues.some((v) => v < 0)) {
          return NextResponse.json(
            { error: "Factor weights must be non-negative" },
            { status: 400 },
          );
        }
        const factorSum = factorValues.reduce((a, b) => a + b, 0);
        if (factorSum === 0) {
          return NextResponse.json(
            { error: "At least one factor weight must be non-zero" },
            { status: 400 },
          );
        }
        if (Math.abs(factorSum - 1) > 0.001 && assumptionsBody.factor_weights) {
          assumptionsBody.factor_weights = normaliseFactorWeights(assumptionsBody.factor_weights);
        }
      }
    }

    // TODO: move to Supabase Edge Function cron for > 20 holdings
    await refreshPortfolioSignals(portfolioId, supabase);

    // Sovereign score pipeline — populates score_token_quality for crypto holdings.
    // Fire-and-forget: TTF scoring is best-effort and must not block the refresh response.
    // Failures are logged inside runSovereignScorePipeline and are non-fatal.
    void (async () => {
      try {
        const { data: holdingRows } = await supabase
          .from("portfolio_holdings")
          .select("id, ticker, asset_class")
          .eq("portfolio_id", portfolioId);
        if (holdingRows && holdingRows.length > 0) {
          await runSovereignScorePipeline(
            portfolioId,
            holdingRows as Array<{ id: string; ticker: string; asset_class: string }>,
          );
        }
      } catch (e) {
        console.warn("[refresh] Sovereign score pipeline failed (non-fatal):", e);
      }
    })();

    return NextResponse.json({ success: true, refreshedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: RouteHandlerContext) {
  const params = await ctx.params;
  const portfolioIdRaw = params.portfolioId;
  const portfolioId = Array.isArray(portfolioIdRaw) ? portfolioIdRaw[0] : portfolioIdRaw;
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const auth = req.headers.get("authorization");
  if (serviceKey && auth === `Bearer ${serviceKey}`) {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    return executeRefresh(req, portfolioId, supabaseAdmin, { skipOwnership: true });
  }

  return withAuth(async (r, user, _c) => {
    const supabase = await createClient();
    return executeRefresh(r, portfolioId, supabase, { skipOwnership: false, user });
  })(req, ctx);
}
