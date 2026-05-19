import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { exportSleeveStrategy } from "@/lib/portfolio/export-sleeve-strategy";
import { authenticateApiKey } from "@/lib/public-api/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const apiKey = await authenticateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized. Provide a valid API key in the Authorization header." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const strategyId = id.trim();

  const { data: strategy, error } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id, publisher_user_id, is_published")
    .eq("id", strategyId)
    .maybeSingle();

  if (error || !strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  if (!(strategy as { is_published: boolean }).is_published) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  const publisherUserId = String((strategy as { publisher_user_id: string }).publisher_user_id);

  const result = await exportSleeveStrategy(publisherUserId, strategyId);
  if (!result) {
    return NextResponse.json({ error: "Failed to export strategy blueprint" }, { status: 500 });
  }

  return NextResponse.json({ blueprint: result.blueprint, sleeveToken: result.sleeveToken });
}
