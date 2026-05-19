import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET — unified creator analytics endpoint
// Returns stats, per-strategy breakdown, 30-day trend, and recent unlock activity.
// Uses blueprint_id (the FK on marketplace_unlocks → marketplace_strategies).
export const GET = withAuth(async (_req, user) => {
  // Fetch creator_stats for this user
  const { data: stats, error: statsError } = await supabaseAdmin
    .from("creator_stats")
    .select("accrued_royalties_cents")
    .eq("creator_user_id", user.id)
    .maybeSingle();

  if (statsError) throw statsError;

  // Fetch this user's published strategies with grade and publication state
  const { data: strategies, error: stratError } = await supabaseAdmin
    .from("marketplace_strategies")
    .select(
      "id, display_name, strategy_grade, blueprint_adherence_score, vw_rsi_performance_score, published_at, is_published",
    )
    .eq("publisher_user_id", user.id)
    .order("published_at", { ascending: false });

  if (stratError) throw stratError;

  const strategyIds = (strategies ?? []).map((s) => String(s.id));

  // Fetch unlock data for all this user's strategies
  // marketplace_unlocks uses blueprint_id as the FK to marketplace_strategies
  let recentUnlocks: Array<{
    blueprint_id: string;
    created_at: string;
    creator_payout_cents: number;
  }> = [];

  if (strategyIds.length > 0) {
    const { data: unlocks } = await supabaseAdmin
      .from("marketplace_unlocks")
      .select("blueprint_id, created_at, creator_payout_cents")
      .in("blueprint_id", strategyIds)
      .order("created_at", { ascending: false });

    recentUnlocks = (unlocks ?? []).map((u) => ({
      blueprint_id: String(u.blueprint_id),
      created_at: String(u.created_at),
      creator_payout_cents: Number(u.creator_payout_cents ?? 0),
    }));
  }

  // Count unlocks per strategy
  const unlocksByStrategy = recentUnlocks.reduce<Record<string, number>>((acc, u) => {
    acc[u.blueprint_id] = (acc[u.blueprint_id] ?? 0) + 1;
    return acc;
  }, {});

  // Compute 30-day earnings trend
  const now = Date.now();
  const days30ms = 30 * 24 * 60 * 60 * 1000;
  const recent30 = recentUnlocks.filter(
    (u) => now - new Date(u.created_at).getTime() < days30ms,
  );
  const previous30 = recentUnlocks.filter((u) => {
    const age = now - new Date(u.created_at).getTime();
    return age >= days30ms && age < days30ms * 2;
  });

  const recentEarningsCents = recent30.reduce((s, u) => s + u.creator_payout_cents, 0);
  const previousEarningsCents = previous30.reduce((s, u) => s + u.creator_payout_cents, 0);

  // Compute total unlocks and lifetime royalties from the unlock ledger
  const totalUnlocks = recentUnlocks.length;
  const totalRoyaltyCents = recentUnlocks.reduce((s, u) => s + u.creator_payout_cents, 0);

  return NextResponse.json({
    stats: {
      total_unlocks: totalUnlocks,
      total_royalty_cents: totalRoyaltyCents,
      accrued_royalties_cents: Number(stats?.accrued_royalties_cents ?? 0),
    },
    strategies: (strategies ?? []).map((s) => ({
      id: String(s.id),
      display_name: s.display_name,
      strategy_grade: s.strategy_grade,
      blueprint_adherence_score: s.blueprint_adherence_score,
      vw_rsi_performance_score: s.vw_rsi_performance_score,
      published_at: s.published_at,
      is_published: Boolean(s.is_published),
      unlock_count: unlocksByStrategy[String(s.id)] ?? 0,
      royalty_cents: recentUnlocks
        .filter((u) => u.blueprint_id === String(s.id))
        .reduce((sum, u) => sum + u.creator_payout_cents, 0),
    })),
    trend: {
      recent30dEarningsCents: recentEarningsCents,
      previous30dEarningsCents: previousEarningsCents,
      recentUnlockCount: recent30.length,
      previousUnlockCount: previous30.length,
    },
    recentUnlocks: recentUnlocks.slice(0, 10).map((u) => ({
      strategy_id: u.blueprint_id,
      unlocked_at: u.created_at,
      royalty_cents: u.creator_payout_cents,
    })),
  });
});
