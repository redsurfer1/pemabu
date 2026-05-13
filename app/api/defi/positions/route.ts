import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertServiceAccess } from "@/lib/security/tier-guard";

const ADDON = "addon_defi_onchain";

export const GET = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, ADDON);

  const walletIdsParam = new URL(req.url).searchParams.get("wallet_ids") ?? "";
  const walletIds = walletIdsParam.split(",").filter(Boolean);
  if (walletIds.length === 0) {
    return NextResponse.json({ positions: [] });
  }

  const { data: wallets, error: walletErr } = await supabaseAdmin
    .from("defi_wallets")
    .select("id")
    .eq("user_id", user.id)
    .in("id", walletIds);

  if (walletErr) throw walletErr;

  const ownedIds = (wallets ?? []).map((w: { id: string }) => w.id);
  if (ownedIds.length === 0) {
    return NextResponse.json({ positions: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("defi_positions")
    .select("*")
    .in("wallet_id", ownedIds)
    .order("usd_value", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return NextResponse.json({ positions: data ?? [] });
});
