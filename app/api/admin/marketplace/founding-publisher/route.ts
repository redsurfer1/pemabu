import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  FOUNDING_CREATOR_ROYALTY_NUMERATOR,
  FOUNDING_PUBLISHER_CAP,
  STANDARD_CREATOR_ROYALTY_NUMERATOR,
} from "@/lib/marketplace/unlock-pricing";

export const GET = withAuth(async (_req, _user, _ctx) => {
  const { data: stats, error: statsError } = await supabaseAdmin
    .from("founding_publisher_stats")
    .select("*")
    .single();

  const { data: founders, error: foundersError } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id, display_name, publisher_user_id, is_founding_publisher, published_at")
    .eq("is_founding_publisher", true)
    .order("published_at", { ascending: true });

  if (statsError || foundersError) {
    return NextResponse.json({ error: "Failed to load founding publisher data" }, { status: 500 });
  }

  return NextResponse.json({
    stats,
    founders: founders ?? [],
    programDetails: {
      cap: FOUNDING_PUBLISHER_CAP,
      royaltySplit: `${FOUNDING_CREATOR_ROYALTY_NUMERATOR}/${100 - FOUNDING_CREATOR_ROYALTY_NUMERATOR}`,
      standardSplit: `${STANDARD_CREATOR_ROYALTY_NUMERATOR}/${100 - STANDARD_CREATOR_ROYALTY_NUMERATOR}`,
    },
  });
});

export const POST = withAuth(async (req, _user, _ctx) => {
  let body: { strategyId?: string; grant?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const strategyId = body.strategyId?.trim();
  if (!strategyId || typeof body.grant !== "boolean") {
    return NextResponse.json({ error: "strategyId and grant (boolean) required" }, { status: 400 });
  }

  if (body.grant) {
    const { data: stats } = await supabaseAdmin
      .from("founding_publisher_stats")
      .select("is_full, slots_remaining")
      .single();

    if (stats?.is_full) {
      return NextResponse.json(
        { error: "Founding Publisher Program is full (50/50 slots used)", slotsRemaining: 0 },
        { status: 409 },
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("marketplace_strategies")
    .update({ is_founding_publisher: body.grant })
    .eq("id", strategyId)
    .select("id, display_name, is_founding_publisher")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: refreshErr } = await supabaseAdmin.rpc("refresh_leaderboard_scores");
  if (refreshErr) {
    console.warn("[founding-publisher] refresh_leaderboard_scores:", refreshErr.message);
  }

  return NextResponse.json({
    strategy: data,
    action: body.grant ? "granted" : "revoked",
    message: body.grant
      ? `${data.display_name} is now a Founding Publisher (80/20 royalty split, featured placement)`
      : `${data.display_name} founding publisher status revoked`,
  });
});
