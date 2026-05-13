import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertServiceAccess } from "@/lib/security/tier-guard";

const ADDON = "addon_macro_intelligence";

export const GET = withAuth(async (_req, user) => {
  await assertServiceAccess(user.id, ADDON);

  const { data, error } = await supabaseAdmin
    .from("macro_regime_history")
    .select("*")
    .eq("user_id", user.id)
    .order("classified_at", { ascending: false })
    .limit(52);

  if (error) throw error;
  return NextResponse.json({ history: data ?? [] });
});
