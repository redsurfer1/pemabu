import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

const ADDON = "addon_macro_intelligence";

export const GET = withAuth(async (_req, user) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!keys.includes(ADDON)) {
    return NextResponse.json({ error: "Macro Intelligence subscription required." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("macro_correlation_cache")
    .select("*")
    .order("asset_pair", { ascending: true });

  if (error) throw error;
  return NextResponse.json({ correlations: data ?? [] });
});
