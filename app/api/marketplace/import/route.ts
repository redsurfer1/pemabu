import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enforceImportEntitlement, ImportEntitlementError } from "@/lib/marketplace/import-gate";
import { spendImportToken } from "@/lib/marketplace/import-token-service";

export const POST = withAuth(async (req, user, _ctx) => {
  let body: { portfolioId?: string; sleeveToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const portfolioId = body.portfolioId?.trim();
  const sleeveToken = body.sleeveToken?.trim();
  if (!portfolioId || !sleeveToken) {
    return NextResponse.json({ error: "portfolioId and sleeveToken required" }, { status: 400 });
  }

  const keys = await getActiveServiceKeysForUser(user.id);
  const tierBlock = requireIntelligenceTier(keys);
  if (tierBlock) return tierBlock;

  try {
    await enforceImportEntitlement(user.id, sleeveToken);
  } catch (err) {
    if (err instanceof ImportEntitlementError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    console.error("Import entitlement check failed:", err);
    return NextResponse.json({ error: "Marketplace lookup failed" }, { status: 500 });
  }

  const out = await importSleeveStrategy(user.id, portfolioId, sleeveToken);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });

  // Spend one import token after a successful import (ledger path only).
  // Idempotency key: user + sleeve + 60-second bucket → safe to retry within the window.
  if (process.env.MARKETPLACE_USE_IMPORT_LEDGER === "true") {
    const idempotencyKey = `${user.id}:${sleeveToken.slice(0, 32)}:${Math.floor(Date.now() / 60_000)}`;
    try {
      await spendImportToken({
        userId: user.id,
        strategyId: null,      // resolved inside gate; null is valid for non-catalog imports
        strategySlug: out.sleeveId,
        portfolioId,
        idempotencyKey,
      });
    } catch (e) {
      // Log only — import already succeeded; balance inconsistency is recoverable
      // via the backfill migration or manual credit adjustment.
      console.error("[import route] Token spend failed after successful import:", e);
    }
  }

  // Fire-and-forget leaderboard refresh — does not block import response (Task Group I)
  void (async () => {
    const { error: refreshErr } = await supabaseAdmin.rpc("refresh_leaderboard_scores");
    if (refreshErr) {
      console.error("refresh_leaderboard_scores (non-fatal):", refreshErr.message);
    }
  })();

  return NextResponse.json({ ok: true, sleeveId: out.sleeveId });
});
