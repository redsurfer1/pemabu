import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicCreatorId } from "@/lib/marketplace/public-creator-id";

export const GET = withAuth(async (_req, user) => {
  const { data: strategies, error } = await supabaseAdmin
    .from("marketplace_strategies")
    .select(
      "id, display_name, strategy_grade, is_founding_publisher, published_at",
    )
    .eq("publisher_user_id", user.id)
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load strategies" }, { status: 500 });
  }

  const rows = strategies ?? [];
  const ids = rows.map((s) => String(s.id));

  const importCounts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: unlocks } = await supabaseAdmin
      .from("marketplace_unlocks")
      .select("blueprint_id")
      .in("blueprint_id", ids);
    for (const u of unlocks ?? []) {
      const bid = String(u.blueprint_id);
      importCounts.set(bid, (importCounts.get(bid) ?? 0) + 1);
    }
  }

  const summaryById = new Map<
    string,
    { consistency: string; avgDriftPct: number | null; weeksTracked: number }
  >();
  if (ids.length > 0) {
    const { data: summaries } = await supabaseAdmin
      .from("strategy_performance_summary")
      .select("strategy_id, consistency, avg_drift_pct, total_weeks_tracked")
      .in("strategy_id", ids);
    for (const s of summaries ?? []) {
      summaryById.set(String(s.strategy_id), {
        consistency: String(s.consistency ?? "new"),
        avgDriftPct: s.avg_drift_pct != null ? Number(s.avg_drift_pct) : null,
        weeksTracked: Number(s.total_weeks_tracked ?? 0),
      });
    }
  }

  return NextResponse.json({
    creatorPublicId: publicCreatorId(user.id),
    strategies: rows.map((s) => {
      const id = String(s.id);
      const perf = summaryById.get(id);
      return {
        id,
        displayName: s.display_name,
        strategyGrade: s.strategy_grade,
        isFoundingPublisher: Boolean(s.is_founding_publisher),
        publishedAt: s.published_at,
        importCount: importCounts.get(id) ?? 0,
        performance: perf ?? {
          consistency: "new",
          avgDriftPct: null,
          weeksTracked: 0,
        },
      };
    }),
  });
}, { keyTemplate: "creator-strategies:{userId}", ...READ_RATE_LIMIT });
