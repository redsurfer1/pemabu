import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MARKETPLACE_UNLOCK_PRICE_CENTS, splitUnlockSale } from "@/lib/marketplace/unlock-pricing";

export const runtime = "nodejs";

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

async function accrueCreatorRoyalty(creatorUserId: string, deltaCents: number): Promise<void> {
  if (deltaCents <= 0) return;
  const { data: row } = await supabaseAdmin
    .from("creator_stats")
    .select("accrued_royalties_cents")
    .eq("creator_user_id", creatorUserId)
    .maybeSingle();
  const prev = Number((row as { accrued_royalties_cents?: number } | null)?.accrued_royalties_cents ?? 0);
  const next = prev + deltaCents;
  const { error } = await supabaseAdmin.from("creator_stats").upsert(
    {
      creator_user_id: creatorUserId,
      accrued_royalties_cents: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_user_id" },
  );
  if (error) throw new Error(error.message);
}

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
    const stripe = stripeClient();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const md = session.metadata ?? {};
  const userId = md.user_id?.trim();
  const blueprintId = md.blueprint_id?.trim();
  const creatorId = md.creator_id?.trim();
  const sessionId = session.id;

  if (!userId || !blueprintId || !creatorId || !sessionId) {
    console.error("checkout.session.completed missing metadata", { md, sessionId });
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
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

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
    if (insErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("marketplace_unlocks insert:", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  try {
    await accrueCreatorRoyalty(creatorId, creatorPayoutCents);
  } catch (e) {
    console.error("creator_stats accrual failed:", e);
    return NextResponse.json({ error: "Unlock recorded but creator accrual failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
