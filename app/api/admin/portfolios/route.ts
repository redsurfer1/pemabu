import { withAdminAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminResponse } from "@/lib/api/response";
import type { Portfolio } from "@/lib/types/database";

export const GET = withAdminAuth(async (_req, _user, _ctx) => {
  const { data: portfolios, error: pErr } = await supabaseAdmin
    .from("portfolios")
    .select("*")
    .order("created_at", { ascending: false });

  if (pErr) throw pErr;

  const portfoliosWithCounts = await Promise.all(
    (portfolios ?? []).map(async (p: Portfolio) => {
      const { count: holdingCount, error: hErr } = await supabaseAdmin
        .from("portfolio_holdings")
        .select("*", { count: "exact", head: true })
        .eq("portfolio_id", p.id);

      if (hErr) throw hErr;

      const { count: signalCount, error: sErr } = await supabaseAdmin
        .from("signals")
        .select("*", { count: "exact", head: true })
        .eq("portfolio_id", p.id)
        .eq("status", "unacknowledged");

      if (sErr) throw sErr;

      return {
        ...p,
        holdings_count: holdingCount ?? 0,
        open_signals: signalCount ?? 0,
      };
    }),
  );

  return adminResponse(portfoliosWithCounts);
});
