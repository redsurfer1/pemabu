import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { MUTATION_RATE_LIMIT, READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { requireAutonomousTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { VAULT_REQUIRED_CODE, VAULT_REQUIRED_MESSAGE } from "@/lib/execution/sovereign-messages";
import { listTradeProposalsForUserVault, isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

const CLOUD_EXECUTION_FORBIDDEN = NextResponse.json(
  { error: VAULT_REQUIRED_MESSAGE, code: VAULT_REQUIRED_CODE },
  { status: 403 },
);

/** List trade proposals — Autonomous tier; vault-only (no Supabase cloud reads). */
export const GET = withAuth(async (req, user, _ctx) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const denied = requireAutonomousTier(keys);
  if (denied) return denied;

  if (!isLocalVaultExecutionPlane()) return CLOUD_EXECUTION_FORBIDDEN;

  const raw = new URL(req.url).searchParams.get("limit");
  const n = raw ? Number(raw) : 25;
  const limit = Number.isFinite(n) ? Math.min(100, Math.max(1, Math.floor(n))) : 25;

  const proposals = await listTradeProposalsForUserVault(user.id, limit);
  return NextResponse.json({ proposals });
}, { keyTemplate: "execution:{userId}", ...READ_RATE_LIMIT });

/** Reserved for future queue mutations — Autonomous tier only; vault-only. */
export const POST = withAuth(async (_req, user, _ctx) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const denied = requireAutonomousTier(keys);
  if (denied) return denied;
  if (!isLocalVaultExecutionPlane()) return CLOUD_EXECUTION_FORBIDDEN;
  return NextResponse.json({ ok: true, queued: 0 });
}, { keyTemplate: "execution:{userId}", ...MUTATION_RATE_LIMIT });
