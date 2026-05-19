import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { withAuth } from "@/lib/api/auth";
import { AI_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { isAutonomous } from "@/lib/portfolio/intelligence-access";
import { StrategyCouncilMemoPdfDocument } from "@/lib/intelligence/strategy-council-pdf-document";
import { REQUIRED_TIER_HEADER, type PemabuTier } from "@/lib/security/tier-guard";
import type { StrategyCouncilMemoPayload } from "@/lib/services/ai";

const BodySchema = z.object({
  markdown: z.string(),
  pdfLayout: z.object({
    documentTitle: z.string().optional(),
    sections: z.array(
      z.object({
        id: z.string(),
        heading: z.string(),
        bodyMarkdown: z.string(),
      }),
    ),
  }),
});

function tier403(): NextResponse {
  const tier: PemabuTier = "AUTONOMOUS";
  return NextResponse.json(
    { error: "Forbidden", code: "TIER_REQUIRED", requiredTier: tier },
    { status: 403, headers: { [REQUIRED_TIER_HEADER]: tier } },
  );
}

export const POST = withAuth(async (req, user, _ctx) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  if (!isAutonomous(keys)) return tier403();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid memo payload" }, { status: 400 });
  }

  const payload: StrategyCouncilMemoPayload = {
    markdown: parsed.data.markdown,
    pdfLayout: {
      documentTitle: parsed.data.pdfLayout.documentTitle ?? "Strategy Council — Monthly Memo",
      sections: parsed.data.pdfLayout.sections,
    },
  };

  try {
    const buf = await renderToBuffer(
      React.createElement(StrategyCouncilMemoPdfDocument, { payload }) as Parameters<typeof renderToBuffer>[0],
    );
    const filename = `strategy-council-memo-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("memo-pdf render", e);
    return NextResponse.json({ error: "PDF render failed" }, { status: 500 });
  }
}, { keyTemplate: "memo-pdf:{userId}", ...AI_RATE_LIMIT });
