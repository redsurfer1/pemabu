import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertServiceAccess } from "@/lib/security/tier-guard";

const ADDON = "addon_macro_intelligence";

export const GET = withAuth(async (_req, user) => {
  await assertServiceAccess(user.id, ADDON);

  const { data, error } = await supabaseAdmin
    .from("macro_correlation_cache")
    .select("*")
    .order("asset_pair", { ascending: true });

  if (error) throw error;
  return NextResponse.json({ correlations: data ?? [] });
}, { keyTemplate: "macro:{userId}", ...READ_RATE_LIMIT });
