import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";

const BundleSizeSchema = z.enum(["single", "five_pack", "twelve_pack"]);

const BodySchema = z.object({
  bundleSize: BundleSizeSchema.default("single"),
  referralCode: z.string().optional(),
});

const BUNDLE_CONFIG = {
  single: {
    quantity: 1,
    priceEnv: "STRIPE_PRICE_IMPORT_TOKEN_SINGLE",
  },
  five_pack: {
    quantity: 5,
    priceEnv: "STRIPE_PRICE_IMPORT_TOKEN_FIVE_PACK",
  },
  twelve_pack: {
    quantity: 12,
    priceEnv: "STRIPE_PRICE_IMPORT_TOKEN_TWELVE_PACK",
  },
} as const;

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia", typescript: true });
}

export const POST = withAuth(async (req, user, _ctx) => {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured on this deployment" }, { status: 503 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const bundle = BUNDLE_CONFIG[body.bundleSize];
  const priceId = process.env[bundle.priceEnv]?.trim();
  if (!priceId) {
    console.error(`[checkout] Missing Stripe price ID for bundle: ${body.bundleSize}`);
    return NextResponse.json({ error: "Bundle pricing not configured. Contact support." }, { status: 503 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const referralCode = body.referralCode?.trim() ?? "";

  try {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        type: "import_token_bundle",
        user_id: user.id,
        token_quantity: String(bundle.quantity),
        bundle_size: body.bundleSize,
        referral_code: referralCode,
      },
      success_url: `${baseUrl}/marketplace?tokens=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/marketplace?tokens=cancel`,
      client_reference_id: user.id,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error("Stripe import token checkout:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout session creation failed" },
      { status: 502 },
    );
  }
});
