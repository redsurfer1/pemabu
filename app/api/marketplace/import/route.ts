import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { importSleeveStrategy } from "@/lib/portfolio/import-sleeve-strategy";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
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

  const out = await importSleeveStrategy(user.id, portfolioId, sleeveToken);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
  return NextResponse.json({ ok: true, sleeveId: out.sleeveId });
});
