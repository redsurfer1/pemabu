import { hashSleeveToken } from "@/lib/portfolio/export-sleeve-strategy";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type MarketplaceImportGateError = {
  ok: false;
  status: 402;
  code: "PAYMENT_REQUIRED";
  message: string;
};

export type MarketplaceImportGateOk = { ok: true };

/**
 * Enforces marketplace_unlocks for published strategies (sleeve hash in marketplace_strategies).
 * Beta/trial group assignments skip payment. Non-catalog imports (no matching row) pass through.
 */
export async function assertMarketplaceImportUnlock(
  userId: string,
  sleeveToken: string,
): Promise<MarketplaceImportGateOk | MarketplaceImportGateError> {
  const tokenHash = hashSleeveToken(sleeveToken.trim());
  const { data: strat, error: stratErr } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id")
    .eq("sleeve_token_hash", tokenHash)
    .maybeSingle();

  if (stratErr) {
    console.error("marketplace_strategies lookup:", stratErr.message);
    throw new Error("Marketplace lookup failed");
  }

  if (!strat?.id) {
    return { ok: true };
  }

  const { data: grp } = await supabaseAdmin
    .from("user_group_assignments")
    .select("subscription_group")
    .eq("user_id", userId)
    .maybeSingle();
  const group = (grp as { subscription_group?: string } | null)?.subscription_group;
  if (group === "beta" || group === "trial") {
    return { ok: true };
  }

  const { data: unlock } = await supabaseAdmin
    .from("marketplace_unlocks")
    .select("id")
    .eq("user_id", userId)
    .eq("blueprint_id", strat.id)
    .maybeSingle();

  if (!unlock) {
    return {
      ok: false,
      status: 402,
      code: "PAYMENT_REQUIRED",
      message:
        "Payment required: purchase a blueprint unlock (Stripe checkout) before importing this published strategy.",
    };
  }

  return { ok: true };
}
