import { supabaseAdmin } from "@/lib/supabase/admin";
import { isSubscriptionRowAccessActive } from "@/lib/constants/services";

const BETA_TRIAL_SERVICE_BUNDLE = [
  "autonomous_annual",
  "intelligence_annual",
  "core_v1",
  "live_broadcast_addon",
  "addon_political_tracker",
] as const;

/**
 * Active `service_key` values for the signed-in user (subscriptions + group grants).
 * Uses the service role with `.eq("user_id", userId)` only — call exclusively with an
 * id that has already been verified (e.g. `withAuth`, server actions after auth, RSC after `getUser()`).
 * Avoids cookie-scoped Supabase in Route Handlers, which often produced opaque 500s from `withAuth`.
 */
export async function getActiveServiceKeysForUser(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("service_key, status")
    .eq("user_id", userId);

  if (error) throw error;
  const keys = (data ?? [])
    .filter((r) => isSubscriptionRowAccessActive((r as { status: string }).status))
    .map((r) => (r as { service_key: string }).service_key);

  const { data: grp } = await supabaseAdmin
    .from("user_group_assignments")
    .select("subscription_group")
    .eq("user_id", userId)
    .maybeSingle();

  const g = grp ? (grp as { subscription_group: string }).subscription_group : null;
  if (g === "beta" || g === "trial") {
    return Array.from(new Set([...keys, ...BETA_TRIAL_SERVICE_BUNDLE]));
  }

  return keys;
}
