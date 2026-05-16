import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Returns the 50 most recent congressional disclosures, optionally filtered by ticker.
// Requires addon_political_tracker OR intelligence_annual / autonomous_annual.
export const GET = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, "addon_political_tracker");

  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker")?.toUpperCase().trim() ?? null;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  let query = supabaseAdmin
    .from("congressional_disclosures")
    .select("*")
    .order("transaction_date", { ascending: false })
    .limit(limit);

  if (ticker) {
    query = query.eq("ticker", ticker);
  }

  const { data, error } = await query;
  if (error) {
    console.error("political-tracker/recent:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disclosures: data ?? [] });
});
