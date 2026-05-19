import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT, READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const ReviewSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  rating: z.number().int().min(1).max(5),
});

export const GET = async (req: Request, ctx: { params: Promise<Record<string, string | string[] | undefined>> }) => {
  const params = await ctx.params;
  const strategyId = String(params.strategyId ?? "").trim();
  if (!strategyId) {
    return NextResponse.json({ error: "strategyId required" }, { status: 400 });
  }

  let viewerUserId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    viewerUserId = user?.id ?? null;
  } catch {
    // not authenticated
  }

  const { data, error } = await supabaseAdmin
    .from("strategy_reviews")
    .select("id, strategy_id, user_id, rating, title, body, created_at")
    .eq("strategy_id", strategyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[reviews GET] Load failed:", error.message);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];

  const { data: profiles } = await supabaseAdmin
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const reviews = (data ?? []).map((r) => ({
    id: r.id,
    strategy_id: r.strategy_id,
    user_id: r.user_id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    created_at: r.created_at,
    reviewer_name: profileMap.get(r.user_id) ?? null,
    is_own: viewerUserId === r.user_id,
  }));

  return NextResponse.json({ reviews });
};

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
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("strategy_reviews")
    .upsert(
      {
        strategy_id: strategyId,
        user_id: user.id,
        rating: parsed.data.rating,
        title: parsed.data.title,
        body: parsed.data.body,
      },
      { onConflict: "strategy_id, user_id", ignoreDuplicates: false },
    )
    .select("id, strategy_id, user_id, rating, title, body, created_at")
    .single();

  if (error) {
    console.error("[reviews POST] Upsert failed:", error.message);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  return NextResponse.json({ success: true, review: data });
}, { keyTemplate: "community:{userId}", ...MUTATION_RATE_LIMIT });
