import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { runStrategyCouncilMemoGeneration } from "@/lib/intelligence/run-strategy-council-memo";
import { z } from "zod";
import { checkRateLimit, STRATEGY_COUNCIL_MEMO_LIMIT } from "@/lib/security/rate-limiter";

const BodySchema = z.object({
  portfolioId: z.string().uuid(),
});

export const POST = withAuth(async (req, user) => {
  const rateLimit = await checkRateLimit({ key: `memo:${user.id}`, ...STRATEGY_COUNCIL_MEMO_LIMIT });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Limit of 5 memos per day." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runStrategyCouncilMemoGeneration(user.id, parsed.data.portfolioId);
  if (!result.success) {
    const status = result.error.includes("Intelligence tier") ? 403 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    markdown: result.markdown,
    pdfLayout: result.pdfLayout,
    contextVersion: result.contextVersion,
    usedFallback: result.usedFallback,
  });
});
