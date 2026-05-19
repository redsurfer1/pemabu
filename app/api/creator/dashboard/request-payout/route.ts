import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";

export const POST = withAuth(
  async (_req, user, _ctx) => {
    const { data: creatorStats } = await supabaseAdmin
      .from("creator_stats")
      .select("accrued_royalties_cents")
      .eq("creator_user_id", user.id)
      .maybeSingle();

    const availableCents = Number(
      creatorStats?.accrued_royalties_cents ?? 0,
    );

    if (availableCents <= 0) {
      return NextResponse.json(
        { error: "No royalties available for payout" },
        { status: 400 },
      );
    }

    const { data: payout, error: insertError } = await supabaseAdmin
      .from("creator_payouts")
      .insert({
        creator_user_id: user.id,
        amount_cents: availableCents,
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !payout) {
      return NextResponse.json(
        { error: "Failed to create payout request" },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("creator_stats")
      .update({
        accrued_royalties_cents: 0,
      })
      .eq("creator_user_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update creator stats" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, payout });
  },
  { keyTemplate: "payout:{userId}", ...MUTATION_RATE_LIMIT },
);
