import { NextResponse } from "next/server";
import { withAuth, AppError } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import Stripe from "stripe";
import { z } from "zod";

const ChangeSchema = z.object({
  targetServiceKey: z.string().min(1),
  /** "upgrade" (proration) | "downgrade" (expire current, schedule new) | "cancel" */
  action: z.enum(["upgrade", "downgrade", "cancel"]),
});

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const parsed = ChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { targetServiceKey, action } = parsed.data;

  if (action === "cancel") {
    const { data: subs } = await supabaseAdmin
      .from("user_subscriptions")
      .select("stripe_subscription_id, stripe_session_id, status, renewal_mode")
      .eq("user_id", user.id)
      .eq("service_key", targetServiceKey)
      .maybeSingle();

    if (!subs) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    if (subs.renewal_mode === "auto" && subs.stripe_subscription_id) {
      await stripeClient().subscriptions.update(subs.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    }

    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .update({ status: "cancelled", ends_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("service_key", targetServiceKey);

    if (error) throw new AppError(error.message, 500, "Failed to cancel subscription");

    return NextResponse.json({ success: true, status: "cancelled" });
  }

  // upgrade / downgrade → create Stripe Checkout for the new plan
  const stripe = stripeClient();

  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const existingCustomerId = profile?.stripe_customer_id;
  let customerId: string;
  if (existingCustomerId) {
    customerId = existingCustomerId;
  } else {
    const customer = await stripe.customers.create({
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from("user_profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  let previousServiceKey: string | undefined;
  if (action === "downgrade") previousServiceKey = targetServiceKey;

  const priceIdEnv = `STRIPE_PRICE_${targetServiceKey.toUpperCase()}`;
  const priceId = process.env[priceIdEnv]?.trim();
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for ${targetServiceKey}`, code: "MISSING_PRICE" },
      { status: 500 },
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        user_id: user.id,
        service_key: targetServiceKey,
        ...(previousServiceKey ? { previous_service_key: previousServiceKey } : {}),
      },
    },
    metadata: {
      type: "saas_subscription",
      user_id: user.id,
      service_key: targetServiceKey,
      renewal_mode: "auto",
    },
    success_url: `${req.url?.startsWith("http") ? new URL(req.url).origin : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/dashboard?subscription=updated`,
    cancel_url: `${req.url?.startsWith("http") ? new URL(req.url).origin : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/upgrade?service=${targetServiceKey}`,
  });

  return NextResponse.json({ url: session.url, sessionId: session.id });
});
