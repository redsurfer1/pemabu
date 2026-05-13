import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { KNOWN_SNAPSHOT_SPACES } from "@/lib/governance/snapshot-client";

const ADDON = "addon_governance_alerts";

async function assertGovernance(userId: string): Promise<NextResponse | null> {
  const keys = await getActiveServiceKeysForUser(userId);
  if (!keys.includes(ADDON)) {
    return NextResponse.json({ error: "Governance Alert subscription required." }, { status: 403 });
  }
  return null;
}

const WatchSchema = z.object({
  token_ticker: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  token_name: z.string().max(60).optional(),
  space_id: z.string().max(100).optional(),
});

export const GET = withAuth(async (_req, user) => {
  const denied = await assertGovernance(user.id);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from("governance_watch_list")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("added_at", { ascending: true });

  if (error) throw error;
  return NextResponse.json({ watchList: data ?? [] });
});

export const POST = withAuth(async (req, user) => {
  const denied = await assertGovernance(user.id);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = WatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const spaceId =
    parsed.data.space_id ?? KNOWN_SNAPSHOT_SPACES[parsed.data.token_ticker] ?? null;

  const { data, error } = await supabaseAdmin
    .from("governance_watch_list")
    .upsert(
      {
        user_id: user.id,
        token_ticker: parsed.data.token_ticker,
        token_name: parsed.data.token_name ?? null,
        space_id: spaceId,
        is_active: true,
      },
      { onConflict: "user_id,token_ticker" },
    )
    .select()
    .single();

  if (error) throw error;
  return NextResponse.json({ watch: data });
});
