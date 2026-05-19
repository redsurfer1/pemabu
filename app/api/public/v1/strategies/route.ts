import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(url.searchParams.get("limit")) || 20), 100);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const { data, error, count } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id, display_name, strategy_grade, publisher_user_id, is_founding_publisher, published_at", { count: "exact" })
    .eq("is_published", true)
    .order("strategy_grade", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch strategies" }, { status: 500 });
  }

  const strategies = (data ?? []).map((r) => ({
    id: String(r.id),
    displayName: String(r.display_name),
    grade: Number(r.strategy_grade),
    isFoundingPublisher: Boolean(r.is_founding_publisher),
    publishedAt: String(r.published_at),
  }));

  return NextResponse.json(
    { data: strategies, meta: { count: strategies.length, total: count ?? 0, limit, offset } },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
