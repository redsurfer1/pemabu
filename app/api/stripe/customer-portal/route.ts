import { NextResponse } from "next/server";
import Stripe from "stripe";
import { withAuth } from "@/lib/api/auth";
import { getBaseUrl } from "@/lib/app-url";
import { supabaseAdmin } from "@/lib/supabase/admin";

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

// Creates a Stripe Billing Portal session for users with auto-renewal subscriptions.
// The portal allows self-service cancellation, payment method updates, and invoice history.
// Requires the Billing Portal to be configured in the Stripe Dashboard first.
export const POST = withAuth(async (_req, user) => {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured on this deployment" }, { status: 503 });
  }

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const customerId = (profile as { stripe_customer_id?: string | null } | null)
    ?.stripe_customer_id;

  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "No billing account found. The Customer Portal is only available for auto-renewal subscriptions.",
      },
      { status: 404 },
    );
  }

  const returnUrl =
    getBaseUrl() + "/upgrade";

  try {
    const session = await stripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe customer portal session creation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Portal session creation failed" },
      { status: 502 },
    );
  }
});
