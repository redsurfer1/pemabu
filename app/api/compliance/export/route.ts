import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NON_FIDUCIARY_FOOTER, NON_ADVISORY_HEADLINE, LEGAL_LAST_UPDATED } from "@/lib/constants/compliance";
import { SENSITIVE_RATE_LIMIT } from "@/lib/security/rate-limiter";

export const POST = withAuth(async (_req, user) => {
  const [portfolioResult, auditResult, briefsResult, aiLogsResult] = await Promise.all([
    supabaseAdmin.from("portfolios").select("id, name, created_at").eq("user_id", user.id),
    supabaseAdmin
      .from("holding_audit_log")
      .select("*, portfolios!inner(user_id)")
      .eq("portfolios.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10000),
    supabaseAdmin
      .from("portfolio_briefs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("ai_interaction_log")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10000),
  ]);

  const packageData = {
    exportedAt: new Date().toISOString(),
    exportedBy: user.id,
    dataClassification: "Confidential — User-Owned Compliance Evidence",
    packageType: "SOC2 Evidence Package v1",
    disclaimers: {
      nonAdvisory: NON_ADVISORY_HEADLINE,
      nonFiduciary: NON_FIDUCIARY_FOOTER,
      lastUpdated: LEGAL_LAST_UPDATED,
    },
    summary: {
      portfolioCount: portfolioResult.data?.length ?? 0,
      auditEventCount: auditResult.data?.length ?? 0,
      briefCount: briefsResult.data?.length ?? 0,
      aiInteractionCount: aiLogsResult.data?.length ?? 0,
      period: (() => {
        const allDates = [
          ...(auditResult.data?.map((a) => a.created_at) ?? []),
          ...(briefsResult.data?.map((b) => b.generated_at) ?? []),
          ...(aiLogsResult.data?.map((l) => l.created_at) ?? []),
        ].filter(Boolean).sort();
        return allDates.length
          ? { from: allDates[allDates.length - 1], to: allDates[0] }
          : { from: null, to: null };
      })(),
    },
    errors: [
      ...(portfolioResult.error ? [{ source: "portfolios", message: portfolioResult.error.message }] : []),
      ...(auditResult.error ? [{ source: "holding_audit_log", message: auditResult.error.message }] : []),
      ...(briefsResult.error ? [{ source: "portfolio_briefs", message: briefsResult.error.message }] : []),
      ...(aiLogsResult.error ? [{ source: "ai_interaction_log", message: aiLogsResult.error.message }] : []),
    ],
    portfolios: portfolioResult.data ?? [],
    auditLog: auditResult.data ?? [],
    portfolioBriefs: briefsResult.data ?? [],
    aiInteractionLog: aiLogsResult.data ?? [],
  };

  if (packageData.errors.length > 0) {
    return NextResponse.json({ error: "Partial data collected", package: packageData }, { status: 200 });
  }

  const json = JSON.stringify(packageData, null, 2);
  const filename = `compliance-evidence-${user.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}, { keyTemplate: "compliance:{userId}", ...SENSITIVE_RATE_LIMIT });
