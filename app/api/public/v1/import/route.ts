import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/public-api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { enforceImportEntitlement, ImportEntitlementError } from "@/lib/marketplace/import-gate";
import { spendImportToken } from "@/lib/marketplace/import-token-service";
import { checkRateLimit, IMPORT_RATE_LIMIT } from "@/lib/security/rate-limiter";

const ImportBody = z.object({
  sleeveToken: z.string().min(1),
  portfolioId: z.string().min(1),
});

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = await authenticateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized. Provide a valid API key in the Authorization header." }, { status: 401 });
  }

  let parsed: z.infer<typeof ImportBody>;
  try {
    const body = (await req.json()) as unknown;
    parsed = ImportBody.parse(body);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sleeveToken, portfolioId } = parsed;

  const rl = await checkRateLimit({ key: `public-import:${apiKey.keyId}`, ...IMPORT_RATE_LIMIT });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many import requests. Please wait before trying again.", code: "RATE_LIMITED", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 },
    );
  }

  const keys = await getActiveServiceKeysForUser(apiKey.userId);
  const tierBlock = requireIntelligenceTier(keys);
  if (tierBlock) return tierBlock;

  try {
    await enforceImportEntitlement(apiKey.userId, sleeveToken);
  } catch (err) {
    if (err instanceof ImportEntitlementError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 });
    }
    return NextResponse.json({ error: "Marketplace lookup failed" }, { status: 500 });
  }

  const out = await importSleeveStrategy(apiKey.userId, portfolioId, sleeveToken);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });

  if (process.env.MARKETPLACE_USE_IMPORT_LEDGER !== "false") {
    const idempotencyKey = `${apiKey.userId}:${sleeveToken.slice(0, 32)}:${Math.floor(Date.now() / 60_000)}`;
    try {
      await spendImportToken({
        userId: apiKey.userId,
        strategyId: null,
        strategySlug: out.sleeveId,
        portfolioId,
        idempotencyKey,
      });
    } catch (e) {
      console.error("[public-import] Token spend failed after successful import:", e);
    }
  }

  void (async () => {
    const { error: refreshErr } = await supabaseAdmin.rpc("refresh_leaderboard_scores");
    if (refreshErr) {
      console.error("refresh_leaderboard_scores (non-fatal):", refreshErr.message);
    }
  })();

  return NextResponse.json({ success: true, sleeveId: out.sleeveId });
}
