import { withAdminAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminResponse } from "@/lib/api/response";
import { getActiveProvider } from "@/lib/market-data";

export const GET = withAdminAuth(async (_req, _user, _ctx) => {
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

  return adminResponse({
    users: usersRes.count ?? 0,
    portfolios: portfoliosRes.count ?? 0,
    unacknowledged_signals: signalsRes.count ?? 0,
    market_data_health: health,
    as_of: new Date().toISOString(),
  });
});
