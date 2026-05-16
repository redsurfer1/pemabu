import { supabaseAdmin } from "@/lib/supabase/admin";
import { SCENARIO_SIM_SOFT_CAP } from "@/lib/constants/services";
import { resolveEffectiveTier } from "@/lib/security/tier-guard";

export type SimCheckResult =
  | { allowed: true; remaining: number | null; current: number }
  | { allowed: false; current: number; cap: number; overageUrl?: string };

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function checkAndIncrementSimUsage(
  userId: string,
  activeServiceKeys: readonly string[],
): Promise<SimCheckResult> {
  const tier = resolveEffectiveTier(activeServiceKeys);

  // Core has no simulation access at all.
  if (tier === "CORE") {
    return { allowed: false, current: 0, cap: 0 };
  }

  // Autonomous is unlimited.
  if (tier === "AUTONOMOUS") {
    await incrementMonthlyCount(userId);
    return { allowed: true, remaining: null, current: 0 };
  }

  // Intelligence: 20/month soft cap.
  const cap = SCENARIO_SIM_SOFT_CAP.intelligence_annual;
  const monthKey = currentMonthKey();

  const { data: row } = await supabaseAdmin
    .from("scenario_simulation_events")
    .select("event_count")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  const current = Number((row as { event_count?: number } | null)?.event_count ?? 0);

  if (current >= cap) {
    return { allowed: false, current, cap };
  }

  await incrementMonthlyCount(userId);
  return { allowed: true, remaining: cap - current - 1, current: current + 1 };
}

async function incrementMonthlyCount(userId: string): Promise<void> {
  const monthKey = currentMonthKey();
  const { error } = await supabaseAdmin.rpc("increment_scenario_sim_count", {
    p_user_id: userId,
    p_month_key: monthKey,
  });
  if (error) {
    // Fallback upsert if RPC not available yet.
    await supabaseAdmin
      .from("scenario_simulation_events")
      .upsert(
        { user_id: userId, month_key: monthKey, event_count: 1, updated_at: new Date().toISOString() },
        { onConflict: "user_id,month_key" },
      );
  }
}

export async function getMonthlyUsage(userId: string): Promise<{ current: number; monthKey: string }> {
  const monthKey = currentMonthKey();
  const { data } = await supabaseAdmin
    .from("scenario_simulation_events")
    .select("event_count")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();
  return { current: Number((data as { event_count?: number } | null)?.event_count ?? 0), monthKey };
}
