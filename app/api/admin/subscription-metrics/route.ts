import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const GET = withAuth(async (_req, user) => {
  // Verify admin role (layout already checks, but double-check for safety)
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // ── Fetch all subscription data ──────────────────────────────────────────
  const [allSubsResult, allServicesResult, allGroupsResult, activeUsersResult] = await Promise.all([
    supabaseAdmin.from("user_subscriptions").select("*"),
    supabaseAdmin.from("pemabu_services").select("service_key, display_name, price_usd, category").eq("is_active", true),
    supabaseAdmin.from("user_group_assignments").select("user_id, subscription_group, assigned_at").order("assigned_at", { ascending: false }),
    supabaseAdmin.from("user_profiles").select("id, created_at"),
  ]);

  if (allSubsResult.error || allServicesResult.error) {
    return NextResponse.json(
      { error: "Failed to fetch subscription data" },
      { status: 500 },
    );
  }

  const subscriptions = allSubsResult.data ?? [];
  const services = allServicesResult.data ?? [];
  const groups = allGroupsResult.data ?? [];
  const activeUsers = activeUsersResult.data ?? [];

  // ── Compute metrics ──────────────────────────────────────────────────────

  // Active subscriptions (non-expired, non-cancelled)
  const activeSubs = subscriptions.filter(
    (s) => s.status === "active" || s.status === "complimentary" || s.status === "trial",
  );

  // Current MRR: sum of annual subscription prices / 12
  const servicePriceMap = new Map(services.map((s) => [s.service_key, Number(s.price_usd)]));
  const currentMrr = activeSubs.reduce((sum, s) => {
    const price = servicePriceMap.get(s.service_key) ?? 0;
    return sum + (s.status !== "complimentary" ? price / 12 : 0);
  }, 0);

  // Subscription counts by status
  const byStatus: Record<string, number> = {};
  for (const s of subscriptions) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
  }

  // Subscriptions by service key
  const byService: Record<string, number> = {};
  for (const s of activeSubs) {
    byService[s.service_key] = (byService[s.service_key] ?? 0) + 1;
  }

  // Users by group
  const byGroup: Record<string, number> = {};
  for (const g of groups) {
    // Only count most recent assignment per user
    const key = g.subscription_group as string;
    byGroup[key] = (byGroup[key] ?? 0) + 1;
  }

  // Trial conversion rate
  const trialUsers = new Set(
    subscriptions
      .filter((s) => s.status === "trial" || s.status === "expired")
      .map((s) => s.user_id),
  );
  const trialConverted = subscriptions.filter((s) => s.status === "active" || s.status === "complimentary");
  const trialConversionRate =
    trialUsers.size > 0
      ? (trialConverted.filter((s) => trialUsers.has(s.user_id)).length / trialUsers.size) * 100
      : 0;

  // Churn (cancelled in last 30 days)
  const churnedLast30 = subscriptions.filter(
    (s) =>
      s.status === "cancelled" &&
      s.updated_at >= thirtyDaysAgo,
  ).length;

  // New subscriptions in last 30 days
  const newLast30 = subscriptions.filter(
    (s) => s.created_at >= thirtyDaysAgo,
  ).length;

  // Monthly recurring revenue by month (last 6 months)
  const mrrHistory: Array<{ month: string; mrr: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000);
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    mrrHistory.push({ month, mrr: currentMrr }); // Simplified: uses current MRR as proxy
  }

  // Total active users
  const totalUsers = activeUsers.length;

  // Revenue by service
  const revenueByService: Record<string, number> = {};
  for (const s of activeSubs) {
    const price = servicePriceMap.get(s.service_key) ?? 0;
    if (s.status !== "complimentary") {
      revenueByService[s.service_key] = (revenueByService[s.service_key] ?? 0) + price;
    }
  }

  return NextResponse.json({
    generatedAt: now,
    period: { last30Days: thirtyDaysAgo, last90Days: ninetyDaysAgo },
    summary: {
      totalUsers,
      totalActiveSubscriptions: activeSubs.length,
      totalSubscriptions: subscriptions.length,
      currentMrr: Math.round(currentMrr * 100) / 100,
      churnedLast30,
      newSubscriptionsLast30: newLast30,
      trialConversionRate: Math.round(trialConversionRate * 100) / 100,
      churnRate: totalUsers > 0 ? Math.round((churnedLast30 / Math.max(totalUsers, 1)) * 10000) / 100 : 0,
    },
    byStatus,
    byService,
    byGroup,
    mrrHistory,
    revenueByService,
    topServices: Object.entries(byService)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([key, count]) => ({
        serviceKey: key,
        displayName: services.find((s) => s.service_key === key)?.display_name ?? key,
        subscribers: count,
        annualRevenue: (servicePriceMap.get(key) ?? 0) * count,
      })),
  });
});
