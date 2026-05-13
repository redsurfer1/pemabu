import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { requireAutonomousTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

/** Placeholder 13F overlay surface — Autonomous tier only. */
export const GET = withAuth(async (_req, user) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const denied = requireAutonomousTier(keys);
  if (denied) return denied;
  return NextResponse.json({ ok: true, message: "13F overlay endpoint reserved for Autonomous execution plane." });
});
