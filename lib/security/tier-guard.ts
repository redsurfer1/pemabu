import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

export const REQUIRED_TIER_HEADER = "REQUIRED_TIER" as const;

export type PemabuTier = "CORE" | "INTELLIGENCE" | "AUTONOMOUS";

/**
 * Highest commercial tier implied by active service keys.
 * Defaults to CORE when no paid Intelligence or Autonomous catalog subscription is present.
 * Beta / trial grants are expanded upstream in `getActiveServiceKeysForUser`.
 */
export function resolveEffectiveTier(activeServiceKeys: readonly string[]): PemabuTier {
  const s = new Set(activeServiceKeys);
  if (s.has("autonomous_annual")) return "AUTONOMOUS";
  if (s.has("intelligence_annual")) return "INTELLIGENCE";
  if (s.has("core_v1")) return "CORE";
  return "CORE";
}

const TIER_RANK: Record<PemabuTier, number> = {
  CORE: 1,
  INTELLIGENCE: 2,
  AUTONOMOUS: 3,
};

export function tierMeetsMinimum(active: PemabuTier, minimum: PemabuTier): boolean {
  return TIER_RANK[active] >= TIER_RANK[minimum];
}

export function tierForbiddenResponse(minimum: PemabuTier): NextResponse {
  return NextResponse.json(
    { error: "Forbidden", code: "TIER_REQUIRED", requiredTier: minimum },
    {
      status: 403,
      headers: { [REQUIRED_TIER_HEADER]: minimum },
    },
  );
}

/** Server components only: redirect if the user lacks an active grant for `serviceKey`. */
export async function requireServiceAccess(serviceKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!keys.includes(serviceKey)) redirect("/access-denied");
}
