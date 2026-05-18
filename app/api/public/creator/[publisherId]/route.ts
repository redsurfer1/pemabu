import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicCreatorId } from "@/lib/marketplace/public-creator-id";
import { MARKETPLACE_UNLOCK_PRICE_CENTS } from "@/lib/marketplace/unlock-pricing";

type RouteContext = { params: Promise<{ publisherId: string }> };

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { publisherId } = await ctx.params;
  const slug = publisherId.trim().toLowerCase();

  const { data: strategies, error } = await supabaseAdmin
    .from("marketplace_strategies")
    .select(
      "id, display_name, strategy_grade, is_founding_publisher, publisher_user_id, published_at, metadata",
    )
    .order("strategy_grade", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load creator data" }, { status: 500 });
  }

  const creatorStrategies = (strategies ?? []).filter(
    (s) => publicCreatorId(String(s.publisher_user_id)) === slug,
  );

  if (creatorStrategies.length === 0) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const creatorUserId = String(creatorStrategies[0]!.publisher_user_id);
  const strategyIds = creatorStrategies.map((s) => String(s.id));

  const { data: creatorStats } = await supabaseAdmin
    .from("creator_stats")
    .select("accrued_royalties_cents")
    .eq("creator_user_id", creatorUserId)
    .maybeSingle();

  const strategiesWithHistory = await Promise.all(
    creatorStrategies.map(async (strategy) => {
      const { data: history } = await supabaseAdmin
        .from("sleeve_performance_log")
        .select("recorded_week, avg_drift_pct, grade, avg_composite_score")
        .eq("sleeve_id", strategy.id)
        .order("recorded_week", { ascending: false })
        .limit(8);

      return {
        id: strategy.id,
        displayName: strategy.display_name,
        grade: strategy.strategy_grade,
        isFoundingPublisher: Boolean(strategy.is_founding_publisher),
        createdAt: strategy.published_at,
        performanceHistory: history ?? [],
      };
    }),
  );

  const { count: totalImports } = await supabaseAdmin
    .from("marketplace_unlocks")
    .select("*", { count: "exact", head: true })
    .in("blueprint_id", strategyIds);

  const accruedCents = Number(creatorStats?.accrued_royalties_cents ?? 0);

  return NextResponse.json(
    {
      creatorId: slug,
      isFoundingPublisher: creatorStrategies.some((s) => s.is_founding_publisher),
      totalStrategies: creatorStrategies.length,
      totalImports: totalImports ?? 0,
      totalRoyaltyTokensEquivalent: Math.floor(accruedCents / MARKETPLACE_UNLOCK_PRICE_CENTS),
      strategies: strategiesWithHistory,
      recentMemo: null,
      notice:
        "All strategy data is historical and informational only. " +
        "Past performance does not indicate future results. " +
        "Nothing on this page constitutes investment advice.",
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
