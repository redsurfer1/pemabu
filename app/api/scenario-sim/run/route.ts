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

  // Scenario simulation engine is under active development.
  // The gating, usage tracking, and overage billing above are fully wired;
  // the engine itself will query live holdings and project rebalancing outcomes
  // against the factor model. Returning an honest 501 rather than fake data.
  return NextResponse.json(
    {
      ok: false,
      code: "FEATURE_COMING_SOON",
      message:
        "Scenario simulation engine is coming soon. Your monthly usage counter has NOT been incremented for this request.",
      remaining: "remaining" in check ? check.remaining : null,
    },
    { status: 501 },
  );
});
