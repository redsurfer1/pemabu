import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT, READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const ReplySchema = z.object({
  body: z.string().min(1).max(5000),
});

export const GET = async (req: Request, ctx: { params: Promise<Record<string, string | string[] | undefined>> }) => {
  const params = await ctx.params;
  const discussionId = String(params.discussionId ?? "").trim();

  if (!discussionId) {
    return NextResponse.json({ error: "discussionId required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("strategy_discussion_replies")
    .select("id, discussion_id, user_id, body, created_at")
    .eq("discussion_id", discussionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[replies GET] Load failed:", error.message);
    return NextResponse.json({ error: "Failed to load replies" }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  const { data: profiles } = await supabaseAdmin
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const replies = (data ?? []).map((r) => ({
    id: r.id,
    discussion_id: r.discussion_id,
    user_id: r.user_id,
    body: r.body,
    created_at: r.created_at,
    author_name: profileMap.get(r.user_id) ?? null,
  }));

  return NextResponse.json({ replies });
};

export const POST = withAuth(async (req, user, ctx) => {
  const params = await ctx.params;
  const discussionId = String(params.discussionId ?? "").trim();
  const strategyId = String(params.strategyId ?? "").trim();

  if (!discussionId || !strategyId) {
    return NextResponse.json({ error: "discussionId and strategyId required" }, { status: 400 });
  }

  const { data: discussion } = await supabaseAdmin
    .from("strategy_discussions")
    .select("id")
    .eq("id", discussionId)
    .eq("strategy_id", strategyId)
    .maybeSingle();

  if (!discussion) {
    return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("strategy_discussion_replies")
    .insert({
      discussion_id: discussionId,
      user_id: user.id,
      body: parsed.data.body,
    })
    .select("id, discussion_id, user_id, body, created_at")
    .single();

  if (error) {
    console.error("[reply POST] Insert failed:", error.message);
    return NextResponse.json({ error: "Failed to post reply" }, { status: 500 });
  }

  return NextResponse.json({ success: true, reply: data });
}, { keyTemplate: "community:{userId}", ...MUTATION_RATE_LIMIT });
