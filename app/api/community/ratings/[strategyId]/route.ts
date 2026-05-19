import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const RatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export const POST = withAuth(async (req, user, ctx) => {
  const params = await ctx.params;
  const strategyId = String(params.strategyId ?? "").trim();
  if (!strategyId) {
    return NextResponse.json({ error: "strategyId required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = RatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("strategy_ratings")
    .select("id")
    .eq("strategy_id", strategyId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Already rated" }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("strategy_ratings")
    .insert({ strategy_id: strategyId, user_id: user.id, rating: parsed.data.rating })
    .select("id, strategy_id, rating, created_at")
    .single();

  if (error) {
    console.error("[ratings POST] Insert failed:", error.message);
    return NextResponse.json({ error: "Failed to submit rating" }, { status: 500 });
  }

  return NextResponse.json({ success: true, rating: data });
}, { keyTemplate: "community:{userId}", ...MUTATION_RATE_LIMIT });

export const GET = async (req: Request, ctx: { params: Promise<Record<string, string | string[] | undefined>> }) => {
  const params = await ctx.params;
  const strategyId = String(params.strategyId ?? "").trim();
  if (!strategyId) {
    return NextResponse.json({ error: "strategyId required" }, { status: 400 });
  }

  const { data: agg, error: aggError } = await supabaseAdmin
    .from("strategy_ratings")
    .select("rating", { count: "exact" })
    .eq("strategy_id", strategyId);

  if (aggError) {
    return NextResponse.json({ error: "Failed to load ratings" }, { status: 500 });
  }

  const count = agg?.length ?? 0;
  const average = count > 0
    ? Math.round((agg!.reduce((sum, r) => sum + r.rating, 0) / count) * 100) / 100
    : 0;

  let userRating: number | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: ur } = await supabaseAdmin
        .from("strategy_ratings")
        .select("rating")
        .eq("strategy_id", strategyId)
        .eq("user_id", user.id)
        .maybeSingle();
      userRating = ur?.rating ?? null;
    }
  } catch {
    // not authenticated — continue
  }

  return NextResponse.json({ average, count, userRating });
};
