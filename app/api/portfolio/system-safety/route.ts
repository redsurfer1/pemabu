import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

export type SystemSafetyHaltCategory = "NONE" | "SAFETY" | "NETWORK";

export const GET = withAuth(async (req, user, _ctx) => {
  const portfolioId = new URL(req.url).searchParams.get("portfolioId");
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  if (isLocalVaultExecutionPlane()) {
    const pool = getVaultPool();
    const { rows: ps } = await pool.query<{ system_status: string }>(
      `SELECT system_status FROM portfolios WHERE id = $1::uuid AND user_id = $2::uuid`,
      [portfolioId, user.id],
    );
    if (!ps[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { rows: es } = await pool.query<{ error_code: string | null }>(
      `SELECT error_code FROM execution_errors
       WHERE portfolio_id = $1::uuid AND succeeded = false
       ORDER BY created_at DESC LIMIT 1`,
      [portfolioId],
    );
    const systemStatus = ps[0].system_status;
    const haltCategory: SystemSafetyHaltCategory =
      systemStatus === "LOCKED" ? "SAFETY" : systemStatus === "PAUSED" ? "NETWORK" : "NONE";
    return NextResponse.json({
      systemStatus,
      haltCategory,
      lastErrorCode: es[0]?.error_code ?? null,
    });
  }

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("portfolios")
    .select("system_status")
    .eq("id", portfolioId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: e } = await supabase
    .from("execution_errors")
    .select("error_code")
    .eq("portfolio_id", portfolioId)
    .eq("succeeded", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const systemStatus = (p as { system_status: string }).system_status;
  const haltCategory: SystemSafetyHaltCategory =
    systemStatus === "LOCKED" ? "SAFETY" : systemStatus === "PAUSED" ? "NETWORK" : "NONE";

  return NextResponse.json({
    systemStatus,
    haltCategory,
    lastErrorCode: e ? (e as { error_code: string | null }).error_code : null,
  });
});
