import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Portfolio } from "@/lib/types/database";

async function verifyAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

export const GET = withAuth(async (req, user, _ctx) => {
  const isAdmin = await verifyAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  return NextResponse.json({ portfolios: portfoliosWithCounts });
});
