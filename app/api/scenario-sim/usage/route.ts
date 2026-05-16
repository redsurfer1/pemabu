import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { resolveEffectiveTier } from "@/lib/security/tier-guard";
import { getMonthlyUsage } from "@/lib/scenario-sim/usage";
import { SCENARIO_SIM_SOFT_CAP } from "@/lib/constants/services";

export const GET = withAuth(async (_req, user) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const tier = resolveEffectiveTier(keys);

  if (tier === "CORE") {
    return NextResponse.json({ tier: "CORE", cap: 0, current: 0, remaining: 0 });
  }

  const { current, monthKey } = await getMonthlyUsage(user.id);

  if (tier === "AUTONOMOUS") {
    return NextResponse.json({ tier: "AUTONOMOUS", cap: null, current, remaining: null, month_key: monthKey });
  }

  const cap = SCENARIO_SIM_SOFT_CAP.intelligence_annual;
  return NextResponse.json({
    tier: "INTELLIGENCE",
    cap,
    current,
    remaining: Math.max(0, cap - current),
    month_key: monthKey,
  });
});
