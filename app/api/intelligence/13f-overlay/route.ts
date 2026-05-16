import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  // Fetch cached 13F data from SEC EDGAR XBRL API (public, no key required).
  // SEC full-text search for latest 13F filings by ticker.
  try {
    const edgarRes = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&dateRange=custom&startdt=${getPriorQuarterDate()}&forms=13F-HR`,
      { headers: { "User-Agent": "Pemabu Platform contact@pemabu.com" }, signal: AbortSignal.timeout(8000) },
    );

    if (!edgarRes.ok) {
      return NextResponse.json({ ticker, filings: [], source: "sec_edgar", error: "EDGAR unavailable" });
    }

    const raw = (await edgarRes.json()) as {
      hits?: { hits?: Array<{ _source?: { period_of_report?: string; entity_name?: string; file_date?: string } }> };
    };

    const filings = (raw.hits?.hits ?? []).slice(0, 20).map((h) => ({
      period: h._source?.period_of_report ?? null,
      filer: h._source?.entity_name ?? null,
      filed: h._source?.file_date ?? null,
    }));

    // Log access for audit trail (fire-and-forget).
    void supabaseAdmin.from("signals").insert({
      portfolio_id: url.searchParams.get("portfolio_id") ?? "00000000-0000-0000-0000-000000000000",
      type: "brief",
      severity: "info",
      status: "acknowledged",
      title: `13F overlay accessed for ${ticker}`,
      metadata: { ticker, user_id: user.id, filing_count: filings.length },
    });

    return NextResponse.json({ ticker, filings, source: "sec_edgar" });
  } catch (e) {
    console.error("13F overlay EDGAR fetch error:", e);
    return NextResponse.json({ ticker, filings: [], source: "sec_edgar", error: "Fetch failed" });
  }
});

function getPriorQuarterDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 4);
  return d.toISOString().split("T")[0];
}
