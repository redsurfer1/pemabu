import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCachedServices } from "@/lib/cache/service-catalog";
import { isSubscriptionRowAccessActive } from "@/lib/constants/services";

/** GET /api/workspace/subscriptions — returns user's current subscriptions with service metadata */
export const GET = withAuth(async (_req, user) => {
  const [subsResult, services] = await Promise.all([
    supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getCachedServices(),
  ]);

  if (subsResult.error) {
    return NextResponse.json({ error: subsResult.error.message }, { status: 500 });
  }

  const serviceMap = new Map(services.map((s) => [s.service_key, s]));
  const enriched = (subsResult.data ?? []).map((sub) => ({
    ...sub,
    service: serviceMap.get(sub.service_key) ?? null,
    is_active: isSubscriptionRowAccessActive(sub.status),
  }));

  return NextResponse.json({ subscriptions: enriched });
});
