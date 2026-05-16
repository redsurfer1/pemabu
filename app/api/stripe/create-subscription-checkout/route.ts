import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PEMABU_SERVICES } from "@/lib/constants/services";

// Per-event services are billed through separate flows, not subscription checkout.
const NON_PURCHASABLE: ReadonlySet<string> = new Set([
  "scenario_sim_overage",
  "marketplace_import_token",
]);

const BodySchema = z.object({
  service_key: z.string().min(1),
  // Only meaningful for annual services. Ignored for one_time services.
  // Defaults to "auto" (Stripe recurring subscription) when omitted.
  renewal_mode: z.enum(["auto", "manual"]).optional(),
});

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

// Retrieve the existing Stripe Customer for this user, or create one.
// Stored in user_profiles.stripe_customer_id to avoid duplicate customers.
async function getOrCreateStripeCustomer(
  stripe: Stripe,
  userId: string,
  userEmail: string | undefined,
): Promise<string> {
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const existingId = (profile as { stripe_customer_id?: string | null } | null)
    ?.stripe_customer_id;

  if (existingId) {
    try {
      const cust = await stripe.customers.retrieve(existingId);
      // Stripe returns a DeletedCustomer object (not a throw) when the customer was deleted.
      if (!(cust as Stripe.DeletedCustomer).deleted) return existingId;
    } catch {
      // Not found — fall through to create a new one.
    }
  }

  const customer = await stripe.customers.create({
    ...(userEmail ? { email: userEmail } : {}),
    metadata: { pemabu_user_id: userId },
  });

  await supabaseAdmin
    .from("user_profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

export const POST = withAuth(async (req, user) => {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json(
      { error: "Stripe is not configured on this deployment" },
      { status: 503 },
    );
  }

  let raw: z.infer<typeof BodySchema>;
  try {
    raw = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid body. Provide service_key and optionally renewal_mode (auto|manual)." },
      { status: 400 },
    );
  }

  const { service_key, renewal_mode } = raw;

  if (NON_PURCHASABLE.has(service_key)) {
    return NextResponse.json(
      { error: `${service_key} cannot be purchased via subscription checkout` },
      { status: 400 },
    );
  }

  const service = PEMABU_SERVICES.find((s) => s.service_key === service_key);
  if (!service) {
    return NextResponse.json({ error: "Unknown service_key" }, { status: 404 });
  }

  // v1_to_v2_upgrade is only available to users who already own core_v1.
  if (service_key === "v1_to_v2_upgrade") {
    const { data: coreRow } = await supabaseAdmin
      .from("user_subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("service_key", "core_v1")
      .maybeSingle();
    const coreStatus = (coreRow as { status?: string } | null)?.status;
    if (coreStatus !== "active" && coreStatus !== "complimentary") {
      return NextResponse.json(
        { error: "An active Core v1 license is required before purchasing the v2 upgrade" },
        { status: 403 },
      );
    }
  }

  // For one_time services (core_v1, v1_to_v2_upgrade), renewal_mode is always "one_time"
  // regardless of what the caller sends.
  const effectiveRenewalMode: "auto" | "manual" | "one_time" =
    service.pricing_model === "one_time" ? "one_time" : (renewal_mode ?? "auto");

  // Block purchase if the user already has a non-expired live subscription for this service.
  // Manual subscriptions may have status "active" with ends_at in the past (no expiry cron
  // for annual rows), so we allow re-purchase when the period has elapsed.
  const { data: existing } = await supabaseAdmin
    .from("user_subscriptions")
    .select("status, ends_at")
    .eq("user_id", user.id)
    .eq("service_key", service_key)
    .maybeSingle();

  const existingRow = existing as { status?: string; ends_at?: string | null } | null;
  const existingStatus = existingRow?.status;
  const existingEndsAt = existingRow?.ends_at ?? null;
  const isTemporallyExpired = existingEndsAt !== null && new Date(existingEndsAt) < new Date();

  if (
    (existingStatus === "active" && !isTemporallyExpired) ||
    existingStatus === "complimentary" ||
    existingStatus === "trial"
  ) {
    return NextResponse.json(
      { error: `You already have an active ${service.display_name} subscription` },
      { status: 409 },
    );
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const unitAmount = Math.round(service.price_usd * 100);

  const productData = {
    name: `Pemabu — ${service.display_name}`,
    ...(service.description ? { description: service.description } : {}),
  };

  const metadata: Record<string, string> = {
    user_id: user.id,
    service_key,
    renewal_mode: effectiveRenewalMode,
    type: "saas_subscription",
  };

  const successUrl = `${baseUrl}/upgrade?success=1&service=${encodeURIComponent(service_key)}&renewal_mode=${effectiveRenewalMode}`;
  const cancelUrl = `${baseUrl}/upgrade?cancelled=1&service=${encodeURIComponent(service_key)}`;

  try {
    const stripe = stripeClient();

    if (effectiveRenewalMode === "auto") {
      // Stripe Subscription mode: recurring annual billing, dunning management,
      // Customer Portal for self-service cancellation and payment method updates.
      const customerId = await getOrCreateStripeCustomer(stripe, user.id, user.email ?? undefined);

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              recurring: { interval: "year" },
              unit_amount: unitAmount,
              product_data: productData,
            },
          },
        ],
        // Propagate metadata onto the Stripe Subscription object so
        // invoice.paid and customer.subscription.deleted can identify the owner.
        subscription_data: { metadata },
        metadata,
        client_reference_id: user.id,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return NextResponse.json({ url: session.url, sessionId: session.id, renewal_mode: "auto" });
    }

    // "manual" or "one_time": single payment, no Stripe Subscription created.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: productData,
          },
        },
      ],
      metadata,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      renewal_mode: effectiveRenewalMode,
    });
  } catch (e) {
    console.error("Stripe create subscription checkout:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout session creation failed" },
      { status: 502 },
    );
  }
});
