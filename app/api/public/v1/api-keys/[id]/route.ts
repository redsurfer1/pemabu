import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRateLimit, MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withAuth(async (req, user, ctx) => {
  const rl = await checkRateLimit({ key: `mutation:${user.id}`, ...MUTATION_RATE_LIMIT });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down.", code: "RATE_LIMITED", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 },
    );
  }

  const params = await ctx.params;
  const id = String(params.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("public_api_keys")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  if ((existing as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("public_api_keys")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
