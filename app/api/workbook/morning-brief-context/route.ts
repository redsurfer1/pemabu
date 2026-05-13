import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { generateMorningBriefContext } from "@/lib/brief/morning-brief-context";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { z } from "zod";

const Body = z.object({ portfolioId: z.string().uuid() });

export const POST = withAuth(async (req, user) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const denied = requireIntelligenceTier(keys);
  if (denied) return denied;

  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = await generateMorningBriefContext(user.id, parsed.data.portfolioId);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ctx);
});
