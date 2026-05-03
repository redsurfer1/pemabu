import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getActiveProvider } from "@/lib/market-data";

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

  const [usersRes, portfoliosRes, signalsRes, health] = await Promise.all([
    supabaseAdmin.from("user_profiles").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("portfolios").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("signals").select("*", { count: "exact", head: true }).eq("status", "unacknowledged"),
    getActiveProvider().healthCheck(),
  ]);

  if (usersRes.error) {
    console.error("GET /api/admin/stats user_profiles count:", usersRes.error);
    throw usersRes.error;
  }
  if (portfoliosRes.error) {
    console.error("GET /api/admin/stats portfolios count:", portfoliosRes.error);
    throw portfoliosRes.error;
  }
  if (signalsRes.error) {
    console.error("GET /api/admin/stats signals count:", signalsRes.error);
    throw signalsRes.error;
  }

  return NextResponse.json({
    users: usersRes.count ?? 0,
    portfolios: portfoliosRes.count ?? 0,
    unacknowledged_signals: signalsRes.count ?? 0,
    market_data_health: health,
    as_of: new Date().toISOString(),
  });
});
