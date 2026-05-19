import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const GET = withAuth(async (_req, user, _ctx) => {
  const { data: strategies } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id")
    .eq("publisher_user_id", user.id);

  const strategyIds = (strategies ?? []).map((s) => String(s.id));
  const totalStrategies = strategyIds.length;

  let totalImports = 0;
  let totalRoyaltiesCents = 0;

  if (strategyIds.length > 0) {
    const { count: importCount } = await supabaseAdmin
      .from("marketplace_unlocks")
      .select("*", { count: "exact", head: true })
      .in("blueprint_id", strategyIds);
    totalImports = importCount ?? 0;

    const { data: royaltySum } = await supabaseAdmin
      .from("marketplace_unlocks")
      .select("creator_payout_cents")
      .in("blueprint_id", strategyIds);
    totalRoyaltiesCents =
      (royaltySum ?? []).reduce(
        (sum, r) => sum + Number(r.creator_payout_cents ?? 0),
        0,
      );
  }

  const { data: creatorStats } = await supabaseAdmin
    .from("creator_stats")
    .select("accrued_royalties_cents")
    .eq("creator_user_id", user.id)
    .maybeSingle();

  const availableForPayoutCents = Number(
    creatorStats?.accrued_royalties_cents ?? 0,
  );

  const { data: pendingRows } = await supabaseAdmin
    .from("creator_payouts")
    .select("amount_cents")
    .eq("creator_user_id", user.id)
    .eq("status", "pending");
  const pendingPayoutCents = (pendingRows ?? []).reduce(
    (sum, r) => sum + Number(r.amount_cents ?? 0),
    0,
  );

  const { data: recentPayouts } = await supabaseAdmin
    .from("creator_payouts")
    .select("*")
    .eq("creator_user_id", user.id)
    .order("requested_at", { ascending: false })
    .limit(10);

  let foundingPublisherSlot: number | null = null;
  const { data: founders } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("publisher_user_id")
    .eq("is_founding_publisher", true)
    .order("published_at", { ascending: true });
  if (founders) {
    const userFounderIndex = founders.findIndex(
      (f) => String(f.publisher_user_id) === user.id,
    );
    if (userFounderIndex !== -1) {
      foundingPublisherSlot = userFounderIndex + 1;
    }
  }

  return NextResponse.json({
    totalStrategies,
    totalImports,
    totalRoyaltiesCents,
    availableForPayoutCents,
    pendingPayoutCents,
    recentPayouts: recentPayouts ?? [],
    foundingPublisherSlot,
  });
});
