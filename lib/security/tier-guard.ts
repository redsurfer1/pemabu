import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCachedServices } from "@/lib/cache/service-catalog";

export const REQUIRED_TIER_HEADER = "REQUIRED_TIER" as const;

export type PemabuTier = "CORE" | "INTELLIGENCE" | "AUTONOMOUS";

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

// ── Unified entitlement (API routes, server actions, server components) ─────

export interface ServiceAccessResult {
  granted: boolean;
  status: string | null;
  serviceKey: string;
}

export async function checkServiceAccess(
  userId: string,
  serviceKey: string,
): Promise<ServiceAccessResult> {
  const catalog = await getCachedServices();
  const known = catalog.some((s) => s.service_key === serviceKey);
  if (!known) {
    return { granted: false, status: null, serviceKey };
  }

  const keys = await getActiveServiceKeysForUser(userId);
  const { data: row } = await supabaseAdmin
    .from("user_subscriptions")
    .select("status")
    .eq("user_id", userId)
    .eq("service_key", serviceKey)
    .maybeSingle();

  const status = row?.status != null ? String(row.status) : null;
  const granted = keys.includes(serviceKey);

  return { granted, status, serviceKey };
}

export async function assertServiceAccess(userId: string, serviceKey: string): Promise<void> {
  const result = await checkServiceAccess(userId, serviceKey);
  if (!result.granted) {
    throw NextResponse.json(
      {
        error: `${serviceKey} subscription required.`,
        serviceKey: result.serviceKey,
        status: result.status,
      },
      { status: 403 },
    );
  }
}

/** Server components only: redirect if the user's effective tier is below `minimum`. */
export async function requireMinimumTier(minimum: PemabuTier): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!tierMeetsMinimum(resolveEffectiveTier(keys), minimum)) {
    redirect(`/upgrade?service=intelligence_annual`);
  }
}

/** Server components only: redirect if the user lacks an active grant for `serviceKey`. */
export async function requireServiceAccess(serviceKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!keys.includes(serviceKey)) {
    redirect(`/upgrade?service=${encodeURIComponent(serviceKey)}`);
  }
}
