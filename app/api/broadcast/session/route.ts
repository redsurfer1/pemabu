import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateBroadcastToken, hashBroadcastToken } from "@/lib/broadcast/token-service";
import { pingFlomismaWatcherUpdate } from "@/lib/execution/flomisma-signal";
import { READ_RATE_LIMIT, MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";

const CreateSchema = z.object({
  portfolio_id: z.string().uuid(),
});

const UpdateSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["go_live", "stop_live", "ping"]),
});

// POST: create a new broadcast session for a portfolio.
export const POST = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, "live_broadcast_addon");

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "portfolio_id (uuid) required" }, { status: 400 });
  }

  // Verify portfolio ownership.
  const { data: portfolio } = await supabaseAdmin
    .from("portfolios")
    .select("id")
    .eq("id", body.portfolio_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  // Expire any existing sessions for this portfolio (one active session at a time).
  await supabaseAdmin
    .from("broadcast_sessions")
    .update({ is_live: false })
    .eq("user_id", user.id)
    .eq("portfolio_id", body.portfolio_id);

  const { raw, hash } = generateBroadcastToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: session, error } = await supabaseAdmin
    .from("broadcast_sessions")
    .insert({
      user_id: user.id,
      portfolio_id: body.portfolio_id,
      viewer_token: raw,
      token_hash: hash,
      is_live: false,
      expires_at: expiresAt,
    })
    .select("id, viewer_token, is_live, expires_at")
    .single();

  if (error) {
    console.error("broadcast session create:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return NextResponse.json({
    session,
    viewer_url: `${baseUrl}/broadcast/${raw}`,
  });
}, { keyTemplate: "broadcast:{userId}", ...MUTATION_RATE_LIMIT });

// PATCH: go_live, stop_live, or ping on an existing session.
export const PATCH = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, "live_broadcast_addon");

  let body: z.infer<typeof UpdateSchema>;
  try {
    body = UpdateSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "token and action (go_live|stop_live|ping) required" }, { status: 400 });
  }

  const tokenHash = hashBroadcastToken(body.token);

  const updates: Record<string, unknown> = {};
  if (body.action === "go_live") updates.is_live = true;
  if (body.action === "stop_live") updates.is_live = false;
  if (body.action === "ping") updates.last_ping_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("broadcast_sessions")
    .update(updates)
    .eq("token_hash", tokenHash)
    .eq("user_id", user.id)
    .select("id, is_live, last_ping_at, expires_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (body.action === "go_live") {
    void pingFlomismaWatcherUpdate().catch(() => void 0);
  }

  return NextResponse.json({ session: data });
}, { keyTemplate: "broadcast:{userId}", ...MUTATION_RATE_LIMIT });

// GET: retrieve the user's active broadcast sessions.
export const GET = withAuth(async (_req, user) => {
  await assertServiceAccess(user.id, "live_broadcast_addon");

  const { data, error } = await supabaseAdmin
    .from("broadcast_sessions")
    .select("id, portfolio_id, viewer_token, is_live, last_ping_at, expires_at, created_at")
    .eq("user_id", user.id)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const sessions = (data ?? []).map((s) => ({
    ...s,
    viewer_url: `${baseUrl}/broadcast/${(s as { viewer_token: string }).viewer_token}`,
  }));

  return NextResponse.json({ sessions });
}, { keyTemplate: "broadcast:{userId}", ...READ_RATE_LIMIT });
