import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { requireIntelligenceTier } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";

interface EdgarSource {
  period_ending?: string;
  period_of_report?: string;
  display_names?: string[];
  file_date?: string;
  form?: string;
}

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
    const edgarRes = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&dateRange=custom&startdt=${getPriorQuarterDate()}&forms=13F-HR`,
      { headers: { "User-Agent": "Pemabu Platform contact@pemabu.com" }, signal: AbortSignal.timeout(8000) },
    );

    if (!edgarRes.ok) {
      return NextResponse.json({ ticker, filings: [], source: "sec_edgar", error: "EDGAR unavailable" });
    }

    const raw = (await edgarRes.json()) as {
      hits?: { hits?: Array<{ _source?: EdgarSource }> };
    };

    const filings = parseEdgarFilings(raw.hits?.hits ?? []);

    return NextResponse.json({ ticker, filings, source: "sec_edgar" });
  } catch (e) {
    console.error("13F overlay EDGAR fetch error:", e);
    return NextResponse.json({ ticker, filings: [], source: "sec_edgar", error: "Fetch failed" });
  }
});

function parseEdgarFilings(
  hits: Array<{ _source?: EdgarSource }>,
): Array<{ period: string | null; filer: string | null; filed: string | null }> {
  const seen = new Set<string>();
  const filings: Array<{ period: string | null; filer: string | null; filed: string | null }> = [];

  for (const hit of hits) {
    const src = hit._source;
    if (!src || src.form !== "13F-HR") continue;

    const period = src.period_ending ?? src.period_of_report ?? null;
    const displayName = src.display_names?.[0] ?? null;
    const key = `${displayName ?? ""}|${period ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const filer = displayName?.replace(/\s*\(CIK\s*\d+\)\s*$/i, "").trim() ?? null;
    filings.push({ period, filer, filed: src.file_date ?? null });
    if (filings.length >= 20) break;
  }

  return filings;
}

function getPriorQuarterDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 4);
  return d.toISOString().split("T")[0];
}
