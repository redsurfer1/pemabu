import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

/** Execution guardrail / safety log (sanitized rows for UI review). */
export const GET = withAuth(async (req, user, _ctx) => {
  const portfolioId = new URL(req.url).searchParams.get("portfolioId");
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolioId required" }, { status: 400 });
  }

  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<{
      succeeded: boolean;
      error_code: string | null;
      created_at: string;
    }>(
      `SELECT succeeded, error_code, created_at::text
       FROM execution_errors
       WHERE portfolio_id = $1::uuid AND user_id = $2::uuid
       ORDER BY created_at DESC
       LIMIT 50`,
      [portfolioId, user.id],
    );
    return NextResponse.json({ entries: rows });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("execution_errors")
    .select("succeeded, error_code, created_at")
    .eq("portfolio_id", portfolioId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}, { keyTemplate: "execution-errors:{userId}", ...READ_RATE_LIMIT });
