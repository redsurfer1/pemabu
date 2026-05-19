import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

export const GET = withAuth(async (_req, user, ctx) => {
  const { portfolioId } = (await ctx.params) as { portfolioId: string };
  if (!portfolioId) return NextResponse.json({ error: "portfolioId required" }, { status: 400 });

  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<{ id: string; name: string; purpose: string }>(
      `SELECT sl.id::text, sl.name, sl.purpose
       FROM sleeves sl
       JOIN portfolios p ON p.id = sl.portfolio_id
       WHERE sl.portfolio_id = $1::uuid AND p.user_id = $2::uuid
       ORDER BY sl.sort_order ASC, sl.created_at ASC`,
      [portfolioId, user.id],
    );
    return NextResponse.json({ sleeves: rows });
  }

  const supabase = await createClient();
  const { data: p } = await supabase.from("portfolios").select("id").eq("id", portfolioId).eq("user_id", user.id).maybeSingle();
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("sleeves")
    .select("id, name, purpose")
    .eq("portfolio_id", portfolioId)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sleeves: data ?? [] });
}, { keyTemplate: "sleeves:{userId}", ...MUTATION_RATE_LIMIT });
