import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { enrichDisclosuresWithSentiment } from "@/lib/political-tracker/disclosure-sentiment";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";

const HISTORY_DAYS = 365;

export const GET = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, "addon_political_tracker");

  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker")?.toUpperCase().trim() ?? null;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const historySince = new Date();
  historySince.setDate(historySince.getDate() - HISTORY_DAYS);
  const historySinceStr = historySince.toISOString().split("T")[0]!;

  let query = supabaseAdmin
    .from("congressional_disclosures")
    .select("*")
    .gte("transaction_date", historySinceStr)
    .order("transaction_date", { ascending: false })
    .limit(500);

  if (ticker) {
    query = query.eq("ticker", ticker);
  }

  const { data, error } = await query;
  if (error) {
    console.error("political-tracker/recent:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const all = data ?? [];
  const display = all.slice(0, limit);
  const disclosures = enrichDisclosuresWithSentiment(all, display);

  return NextResponse.json({ disclosures });
}, { keyTemplate: "political:{userId}", ...READ_RATE_LIMIT });
