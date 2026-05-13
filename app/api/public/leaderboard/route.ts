import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PreviewRow = {
  id: string;
  display_name: string;
  strategy_grade: number;
  blueprint_adherence_score: number;
  vw_rsi_performance_score: number;
  subscriber_count: number;
  published_at: string;
};

/** Top strategies for marketing — no auth. MV when available; else public view + zero subs. */
export async function GET() {
  const mv = await supabaseAdmin
    .from("marketplace_leaderboard_scores")
    .select(
      "id, display_name, strategy_grade, blueprint_adherence_score, vw_rsi_performance_score, subscriber_count, published_at",
    )
    .order("strategy_grade", { ascending: false })
    .limit(5);

  let rows: PreviewRow[] = [];

  if (!mv.error && mv.data?.length) {
    rows = mv.data.map((r) => ({
      id: String(r.id),
      display_name: String(r.display_name),
      strategy_grade: Number(r.strategy_grade),
      blueprint_adherence_score: Number(r.blueprint_adherence_score),
      vw_rsi_performance_score: Number(r.vw_rsi_performance_score),
      subscriber_count: Number(r.subscriber_count ?? 0),
      published_at: String(r.published_at),
    }));
  } else {
    const fb = await supabaseAdmin
      .from("marketplace_leaderboard_public")
      .select("id, display_name, strategy_grade, blueprint_adherence_score, vw_rsi_performance_score, published_at")
      .order("strategy_grade", { ascending: false })
      .limit(5);
    if (!fb.error && fb.data?.length) {
      rows = fb.data.map((r) => ({
        id: String(r.id),
        display_name: String(r.display_name),
        strategy_grade: Number(r.strategy_grade),
        blueprint_adherence_score: Number(r.blueprint_adherence_score),
        vw_rsi_performance_score: Number(r.vw_rsi_performance_score),
        subscriber_count: 0,
        published_at: String(r.published_at),
      }));
    }
  }

  return NextResponse.json(
    { data: rows, meta: { count: rows.length, timestamp: new Date().toISOString() } },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=30",
      },
    },
  );
}
