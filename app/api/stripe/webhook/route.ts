import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MARKETPLACE_UNLOCK_PRICE_CENTS, splitUnlockSale } from "@/lib/marketplace/unlock-pricing";
import { creditTokensFromStripe } from "@/lib/marketplace/import-token-service";

export const runtime = "nodejs";

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

// ── Marketplace unlock ────────────────────────────────────────────────────────

async function accrueCreatorRoyalty(creatorUserId: string, deltaCents: number): Promise<void> {
  if (deltaCents <= 0) return;
  const { data: row } = await supabaseAdmin
    .from("creator_stats")
    .select("accrued_royalties_cents")
    .eq("creator_user_id", creatorUserId)
    .maybeSingle();
  const prev = Number(
    (row as { accrued_royalties_cents?: number } | null)?.accrued_royalties_cents ?? 0,
  );
  const { error } = await supabaseAdmin.from("creator_stats").upsert(
    {
      creator_user_id: creatorUserId,
      accrued_royalties_cents: prev + deltaCents,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_user_id" },
  );
  if (error) throw new Error(error.message);
}

async function handleMarketplaceUnlock(session: Stripe.Checkout.Session): Promise<Response | null> {
  const md = session.metadata ?? {};
  const userId = md.user_id?.trim();
  const blueprintId = md.blueprint_id?.trim();
  const creatorId = md.creator_id?.trim();
  const sessionId = session.id;

  if (!userId || !blueprintId || !creatorId || !sessionId) {
    console.error("checkout.session.completed missing marketplace metadata", { md, sessionId });
    return NextResponse.json({ error: "Invalid session metadata" }, { status: 400 });
  }

  const amountCents =
    typeof session.amount_total === "number" && session.amount_total > 0
      ? session.amount_total
      : MARKETPLACE_UNLOCK_PRICE_CENTS;

  const { creatorPayoutCents, platformFeeCents, creatorRoyaltyPct } = splitUnlockSale(amountCents);

  const { data: existing } = await supabaseAdmin
    .from("marketplace_unlocks")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  const { error: insErr } = await supabaseAdmin.from("marketplace_unlocks").insert({
    user_id: userId,
    blueprint_id: blueprintId,
    stripe_session_id: sessionId,
    price_paid_cents: amountCents,
    creator_royalty_pct: creatorRoyaltyPct,
    creator_payout_cents: creatorPayoutCents,
    platform_fee_cents: platformFeeCents,
  });

  if (insErr) {
    if (insErr.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("marketplace_unlocks insert:", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  try {
    await accrueCreatorRoyalty(creatorId, creatorPayoutCents);
  } catch (e) {
    console.error("creator_stats accrual failed:", e);
    return NextResponse.json(
      { error: "Unlock recorded but creator accrual failed" },
      { status: 500 },
    );
  }

  // Ledger credit — only active when MARKETPLACE_USE_IMPORT_LEDGER=true.
  // Both the unlock row (above) AND the ledger credit are written during the
  // transition period. Once the flag is permanently true and the backfill has
  // run, the unlock insert can be removed in a follow-up migration.
  if (process.env.MARKETPLACE_USE_IMPORT_LEDGER === "true") {
    try {
      await creditTokensFromStripe({
        userId,
        stripeSessionId: sessionId,
        quantity: 1,
        amountUsdCents: amountCents,
      });
    } catch (e) {
      // Non-fatal for the webhook response — the unlock row was already written.
      // Log for monitoring; the backfill migration can heal any missed credits.
      console.error("import-token ledger credit failed (non-fatal):", e);
    }
  }

  return null;
}

// ── SaaS subscription checkout ────────────────────────────────────────────────

async function handleSaasSubscriptionCheckout(
  session: Stripe.Checkout.Session,
): Promise<Response | null> {
  const md = session.metadata ?? {};
  const userId = md.user_id?.trim();
  const serviceKey = md.service_key?.trim();
  // renewal_mode is the authoritative field; pricing_model is no longer used here.
  const renewalMode = md.renewal_mode?.trim() as "auto" | "manual" | "one_time" | undefined;
  const sessionId = session.id;

  if (!userId || !serviceKey || !renewalMode) {
    console.error("saas checkout.session.completed missing metadata", { md, sessionId });
    // Return 200: session is permanently malformed, retrying will not help.
    return NextResponse.json({ received: true, error: "missing_metadata" });
  }

  // Idempotency: reject duplicate webhook delivery for the same session.
  const { data: existingBySession } = await supabaseAdmin
    .from("user_subscriptions")
    .select("id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (existingBySession) return NextResponse.json({ received: true, duplicate: true });

  // Extract Stripe identifiers from the session.
  const stripeSubscriptionId =
    session.mode === "subscription" && session.subscription
      ? typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription).id
      : null;

  const stripeCustomerId =
    session.customer != null
      ? typeof session.customer === "string"
        ? session.customer
        : (session.customer as Stripe.Customer).id
      : null;

  // ends_at:
  //   auto / manual → 1 year from today (UTC midnight).
  //     For auto, invoice.paid will overwrite with Stripe's authoritative period_end on renewal.
  //   one_time      → null (perpetual license, never expires).
  const now = new Date();
  const endsAt =
    renewalMode === "one_time"
      ? null
      : new Date(
          Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()),
        ).toISOString();

  const pricePaidUsd =
    typeof session.amount_total === "number" && session.amount_total > 0
      ? session.amount_total / 100
      : null;

  // Persist the Stripe Customer ID onto the user profile so the Customer Portal
  // route can retrieve it without an additional Stripe API call.
  if (stripeCustomerId) {
    const { error: profileErr } = await supabaseAdmin
      .from("user_profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", userId);
    if (profileErr) {
      // Non-fatal: portal access will fail but the subscription still activates.
      console.error("user_profiles stripe_customer_id update failed:", profileErr.message);
    }
  }

  const { error } = await supabaseAdmin.from("user_subscriptions").upsert(
    {
      user_id: userId,
      service_key: serviceKey,
      status: "active",
      price_paid_usd: pricePaidUsd,
      starts_at: now.toISOString(),
      ends_at: endsAt,
      renewal_mode: renewalMode,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_session_id: sessionId,
    },
    { onConflict: "user_id,service_key" },
  );

  if (error) {
    console.error("user_subscriptions upsert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return null;
}

// ── Annual renewal (auto only) ────────────────────────────────────────────────

// Fires on every successful Stripe invoice payment:
//   • First payment: alongside checkout.session.completed — both upserts are idempotent.
//   • Subsequent renewals: this is the only event; it extends ends_at to Stripe's period_end.
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<Response | null> {
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription as Stripe.Subscription | null)?.id ?? null;

  if (!subscriptionId) return null; // one-time invoice, not tied to a subscription

  const periodEndMs = (invoice.period_end ?? 0) * 1000;
  if (!periodEndMs) return null;

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({ status: "active", ends_at: new Date(periodEndMs).toISOString() })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.error("invoice.paid ends_at extension failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return null;
}

// ── Cancellation / dunning failure (auto only) ────────────────────────────────

// Fires when Stripe cancels a subscription: payment retries exhausted, manual cancel
// via Customer Portal, or programmatic cancellation.
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<Response | null> {
  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({ status: "cancelled", ends_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("customer.subscription.deleted cancel failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return null;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── checkout.session.completed ────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.metadata?.type === "saas_subscription") {
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        return NextResponse.json({ received: true });
      }
      const err = await handleSaasSubscriptionCheckout(session);
      return err ?? NextResponse.json({ received: true });
    }

    // Marketplace blueprint unlock — original flow unchanged.
    if (session.mode !== "payment" || session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }
    const err = await handleMarketplaceUnlock(session);
    return err ?? NextResponse.json({ received: true });
  }

  // ── invoice.paid — auto-renewal extension ────────────────────────────────
  if (event.type === "invoice.paid") {
    const err = await handleInvoicePaid(event.data.object as Stripe.Invoice);
    return err ?? NextResponse.json({ received: true });
  }

  // ── customer.subscription.deleted — cancellation ─────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const err = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    return err ?? NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
