import { NextResponse } from "next/server";

export const REQUIRED_TIER_HEADER = "REQUIRED_TIER" as const;

export type PemabuTier = "CORE" | "INTELLIGENCE" | "AUTONOMOUS";

/**
 * Highest commercial tier implied by active service keys.
 * Defaults to CORE when no paid subscription is present (free Core tier).
 * Beta / trial grants are expanded upstream in `getActiveServiceKeysForUser`.
 */
export function resolveEffectiveTier(activeServiceKeys: readonly string[]): PemabuTier {
  const s = new Set(activeServiceKeys);
  if (s.has("autonomous_annual")) return "AUTONOMOUS";
  if (s.has("intelligence_annual")) return "INTELLIGENCE";
  if (s.has("core_v1") || s.has("core_free")) return "CORE";
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
