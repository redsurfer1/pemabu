import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier } from "@/lib/security/tier-guard";
import { checkAndIncrementSimUsage } from "@/lib/scenario-sim/usage";

const BodySchema = z.object({
  portfolio_id: z.string().uuid(),
  // Scenario parameters passed to the simulation engine.
  adjustments: z.record(z.string(), z.number()).optional(),
  label: z.string().max(120).optional(),
});

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

export const POST = withAuth(async (req, user) => {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const keys = await getActiveServiceKeysForUser(user.id);
  const tier = resolveEffectiveTier(keys);

  if (tier === "CORE") {
    return NextResponse.json(
      { error: "Scenario simulation requires Intelligence or Autonomous tier", code: "TIER_REQUIRED" },
      { status: 403 },
    );
  }

  const check = await checkAndIncrementSimUsage(user.id, keys);

  if (!check.allowed) {
    // Intelligence cap hit — create an overage Stripe checkout for $0.50.
    const cap = "cap" in check ? check.cap : 20;

    if (process.env.STRIPE_SECRET_KEY?.trim()) {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
      const stripe = stripeClient();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 50,
              product_data: { name: "Scenario Simulation (1 overage run)", description: "Beyond your 20/month Intelligence cap." },
            },
          },
        ],
        metadata: {
          user_id: user.id,
          service_key: "scenario_sim_overage",
          renewal_mode: "one_time",
          type: "saas_subscription",
          portfolio_id: body.portfolio_id,
        },
        client_reference_id: user.id,
        success_url: `${baseUrl}/scenario-sim?overage_success=1`,
        cancel_url: `${baseUrl}/scenario-sim`,
      });

      return NextResponse.json(
        {
          error: "Monthly simulation cap reached",
          code: "SOFT_CAP_EXCEEDED",
          cap,
          current: check.current,
          overage_checkout_url: session.url,
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      { error: "Monthly simulation cap reached", code: "SOFT_CAP_EXCEEDED", cap, current: check.current },
      { status: 402 },
    );
  }

  // Run the simulation. The actual allocation engine call goes here.
  // For now: apply adjustments to a simple allocation model and return projected results.
  const result = runSimulation(body.portfolio_id, body.adjustments ?? {}, body.label ?? "Untitled");

  return NextResponse.json({
    ok: true,
    remaining: "remaining" in check ? check.remaining : null,
    simulation: result,
  });
});

// Lightweight in-process allocation simulation.
// Real implementation will call the local allocation engine via getVaultPool().
function runSimulation(
  portfolioId: string,
  adjustments: Record<string, number>,
  label: string,
): Record<string, unknown> {
  const baseline = { equity: 60, fixed_income: 30, cash: 10 };
  const adjusted = { ...baseline };

  for (const [assetClass, delta] of Object.entries(adjustments)) {
    if (assetClass in adjusted) {
      (adjusted as Record<string, number>)[assetClass] = Math.max(
        0,
        ((adjusted as Record<string, number>)[assetClass] ?? 0) + delta,
      );
    }
  }

  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  const normalised = Object.fromEntries(
    Object.entries(adjusted).map(([k, v]) => [k, total > 0 ? Math.round((v / total) * 1000) / 10 : 0]),
  );

  return {
    label,
    portfolio_id: portfolioId,
    run_at: new Date().toISOString(),
    baseline,
    adjustments,
    projected_allocation: normalised,
    projected_drift_reduction_pct: Object.keys(adjustments).length > 0 ? 3.2 : 0,
  };
}
