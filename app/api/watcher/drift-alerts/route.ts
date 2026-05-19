import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { getVaultPool } from "@/lib/db";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";

export const GET = withAuth(async (req, user) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const denied = requireIntelligenceTier(keys);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const portfolioId = searchParams.get("portfolioId");
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!portfolio) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (process.env.USE_LOCAL_VAULT === "true") {
    const pool = getVaultPool();
    const { rows } = await pool.query<{
      id: string;
      drift_pct: string;
      metric: string;
      detected_at: string;
    }>(
      `SELECT id::text, drift_pct::text, metric, detected_at::text
       FROM portfolio_drift_alerts
       WHERE portfolio_id = $1
       ORDER BY detected_at DESC
       LIMIT 100`,
      [portfolioId],
    );
    return NextResponse.json({ alerts: rows });
  }

  const { data, error } = await supabase
    .from("portfolio_drift_alerts")
    .select("id, drift_pct, metric, detected_at")
    .eq("portfolio_id", portfolioId)
    .order("detected_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data ?? [] });
}, { keyTemplate: "drift-alerts:{userId}", ...READ_RATE_LIMIT });
