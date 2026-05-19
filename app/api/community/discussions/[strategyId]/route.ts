import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT, READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const DiscussionSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

export const GET = async (req: Request, ctx: { params: Promise<Record<string, string | string[] | undefined>> }) => {
  const params = await ctx.params;
  const strategyId = String(params.strategyId ?? "").trim();
  if (!strategyId) {
    return NextResponse.json({ error: "strategyId required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("strategy_discussions")
    .select("id, strategy_id, user_id, title, body, is_pinned, created_at")
    .eq("strategy_id", strategyId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[discussions GET] Load failed:", error.message);
    return NextResponse.json({ error: "Failed to load discussions" }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((d) => d.user_id))];

  const { data: profiles } = await supabaseAdmin
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const discussionIds = (data ?? []).map((d) => d.id);

  const { data: replyCounts } = await supabaseAdmin
    .from("strategy_discussion_replies")
    .select("discussion_id")
    .in("discussion_id", discussionIds);

  const replyCountMap = new Map<string, number>();
  for (const r of replyCounts ?? []) {
    replyCountMap.set(r.discussion_id, (replyCountMap.get(r.discussion_id) ?? 0) + 1);
  }

  const discussions = (data ?? []).map((d) => ({
    id: d.id,
    strategy_id: d.strategy_id,
    user_id: d.user_id,
    title: d.title,
    body: d.body,
    is_pinned: d.is_pinned,
    created_at: d.created_at,
    reply_count: replyCountMap.get(d.id) ?? 0,
    author_name: profileMap.get(d.user_id) ?? null,
  }));

  return NextResponse.json({ discussions });
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
  const parsed = DiscussionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("strategy_discussions")
    .insert({
      strategy_id: strategyId,
      user_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
    })
    .select("id, strategy_id, user_id, title, body, is_pinned, created_at")
    .single();

  if (error) {
    console.error("[discussions POST] Insert failed:", error.message);
    return NextResponse.json({ error: "Failed to create discussion" }, { status: 500 });
  }

  return NextResponse.json({ success: true, discussion: data });
}, { keyTemplate: "community:{userId}", ...MUTATION_RATE_LIMIT });
