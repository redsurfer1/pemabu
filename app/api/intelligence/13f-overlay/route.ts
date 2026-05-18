import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import {
  buildThirteenFOverlayRows,
  searchEdgarThirteenF,
} from "@/lib/intelligence/thirteen-f-edgar";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

/** 13F institutional ownership overlay — Intelligence tier and above. */
export const GET = withAuth(async (req, user) => {
  const keys = await getActiveServiceKeysForUser(user.id);
  const denied = requireIntelligenceTier(keys);
  if (denied) return denied;

  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker")?.toUpperCase().trim();

  if (!ticker) {
    return NextResponse.json({ error: "ticker query parameter required" }, { status: 400 });
  }

  try {
    const hits = await searchEdgarThirteenF(ticker);
    if (hits.length === 0) {
      return NextResponse.json({ ticker, filings: [], source: "sec_edgar" });
    }

    const filings = await buildThirteenFOverlayRows(hits, ticker);

    return NextResponse.json({ ticker, filings, source: "sec_edgar" });
  } catch (e) {
    console.error("13F overlay EDGAR fetch error:", e);
    return NextResponse.json({ ticker, filings: [], source: "sec_edgar", error: "Fetch failed" });
  }
});
