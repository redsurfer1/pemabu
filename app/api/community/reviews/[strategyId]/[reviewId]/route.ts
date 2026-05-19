import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const DELETE = withAuth(async (_req, user, ctx) => {
  const params = await ctx.params;
  const reviewId = String(params.reviewId ?? "").trim();
  const strategyId = String(params.strategyId ?? "").trim();

  if (!reviewId || !strategyId) {
    return NextResponse.json({ error: "reviewId and strategyId required" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("strategy_reviews")
    .select("id, user_id")
    .eq("id", reviewId)
    .eq("strategy_id", strategyId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not your review" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("strategy_reviews")
    .delete()
    .eq("id", reviewId);

  if (error) {
    console.error("[review DELETE] Delete failed:", error.message);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}, { keyTemplate: "community:{userId}", ...MUTATION_RATE_LIMIT });
