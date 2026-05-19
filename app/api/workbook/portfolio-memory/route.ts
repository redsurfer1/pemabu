import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildPortfolioMemoryEvents,
  PORTFOLIO_MEMORY_NOTICE,
} from "@/lib/portfolio/portfolio-memory-events";
import type { PortfolioMemoryResponse } from "@/lib/types/portfolio-memory";

export const GET = withAuth(async (req, user) => {
  const portfolioId = new URL(req.url).searchParams.get("portfolioId")?.trim();
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  const { data: portfolio, error: portError } = await supabaseAdmin
    .from("portfolios")
    .select("id, name, created_at")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (portError || !portfolio) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
  }

  const [{ data: holdings }, { data: driftAlerts }, { data: briefs }, { data: assumptions }, { data: auditLog }] =
    await Promise.all([
      supabaseAdmin
        .from("portfolio_holdings")
        .select("id, ticker, asset_class, created_at")
        .eq("portfolio_id", portfolioId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("portfolio_drift_alerts")
        .select("id, drift_pct, metric, detected_at")
        .eq("portfolio_id", portfolioId)
        .order("detected_at", { ascending: true }),
      supabaseAdmin
        .from("portfolio_briefs")
        .select("id, generated_at")
        .eq("portfolio_id", portfolioId)
        .order("generated_at", { ascending: true }),
      supabaseAdmin
        .from("portfolio_assumptions")
        .select("id, updated_at")
        .eq("portfolio_id", portfolioId)
        .limit(1),
      supabaseAdmin
        .from("holding_audit_log")
        .select("id, event_type, ticker, created_at")
        .eq("portfolio_id", portfolioId)
        .in("event_type", ["FULL_EXIT", "PARTIAL_SELL"])
        .order("created_at", { ascending: true }),
    ]);

  const events = buildPortfolioMemoryEvents({
    portfolio,
    holdings: holdings ?? [],
    driftAlerts: driftAlerts ?? [],
    briefs: briefs ?? [],
    assumptions: assumptions ?? [],
    auditLog: auditLog ?? [],
  });

  const holdingCount = holdings?.length ?? 0;
  const driftAlertCount = driftAlerts?.length ?? 0;
  const briefCount = briefs?.length ?? 0;
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(portfolio.created_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  const body: PortfolioMemoryResponse = {
    portfolioId,
    portfolioName: portfolio.name,
    createdAt: portfolio.created_at,
    daysSinceCreation,
    summary: {
      totalEvents: events.length,
      holdingsAdded: holdingCount,
      driftAlertsReceived: driftAlertCount,
      briefsGenerated: briefCount,
    },
    events,
    notice: PORTFOLIO_MEMORY_NOTICE,
    limitations: [
      "Assumption change history records latest update only (no per-edit audit table yet).",
      "Holding removals depend on audit log entries (FULL_EXIT / PARTIAL_SELL).",
    ],
  };

  return NextResponse.json(body);
}, { keyTemplate: "portfolio-memory:{userId}", ...READ_RATE_LIMIT });
