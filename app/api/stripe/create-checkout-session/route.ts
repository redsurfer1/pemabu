import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MARKETPLACE_UNLOCK_PRICE_CENTS } from "@/lib/marketplace/unlock-pricing";
import { hashSleeveToken } from "@/lib/portfolio/export-sleeve-strategy";

const BodySchema = z
  .object({
    blueprintId: z.string().uuid().optional(),
    sleeveToken: z.string().min(1).optional(),
  })
  .refine((b) => !!b.blueprintId?.trim() || !!b.sleeveToken?.trim(), {
    message: "blueprintId or sleeveToken required",
  });

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

export const POST = withAuth(async (req, user, _ctx) => {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured on this deployment" }, { status: 503 });
  }

  let raw: z.infer<typeof BodySchema>;
  try {
    raw = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body; provide blueprintId (uuid) and/or sleeveToken" }, { status: 400 });
  }

  let blueprintId = raw.blueprintId?.trim();
  if (!blueprintId && raw.sleeveToken) {
    const h = hashSleeveToken(raw.sleeveToken.trim());
    const { data: byTok } = await supabaseAdmin
      .from("marketplace_strategies")
      .select("id")
      .eq("sleeve_token_hash", h)
      .maybeSingle();
    blueprintId = byTok?.id as string | undefined;
  }

  if (!blueprintId) {
    return NextResponse.json({ error: "Blueprint not found for this identifier" }, { status: 404 });
  }

  const { data: strat, error: selErr } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id, publisher_user_id")
    .eq("id", blueprintId)
    .maybeSingle();

  if (selErr || !strat) {
    return NextResponse.json({ error: "Blueprint not found" }, { status: 404 });
  }
  const creatorId = strat.publisher_user_id as string | null;
  if (!creatorId) {
    return NextResponse.json({ error: "Blueprint has no publisher; cannot checkout" }, { status: 400 });
  }
  if (creatorId === user.id) {
    return NextResponse.json({ error: "You cannot purchase a checkout session for your own blueprint" }, { status: 400 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  try {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: MARKETPLACE_UNLOCK_PRICE_CENTS,
            product_data: {
              name: "Pemabu marketplace — blueprint unlock",
              description: "One-time unlock to import this published strategy into your portfolio.",
            },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        blueprint_id: blueprintId,
        creator_id: creatorId,
      },
      success_url: `${baseUrl}/marketplace?unlock=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/marketplace?unlock=cancel`,
      client_reference_id: user.id,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("Stripe create checkout session:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout session creation failed" },
      { status: 502 },
    );
  }
});
