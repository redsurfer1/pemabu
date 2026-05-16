import { supabaseAdmin } from "../../lib/supabase/admin";

interface HswTransaction {
  transaction_date: string;
  owner: string;
  ticker: string;
  asset_description: string;
  asset_type: string;
  type: string;
  amount: string;
  representative: string;
  party?: string;
  state?: string;
  industry?: string;
  sector?: string;
  filed_at_date?: string;
  disclosure_date?: string;
}

// House Stock Watcher public API — no key required.
// Returns the 1,000 most recent transactions per page (page 0 = latest).
const HSW_BASE = "https://housestockwatcher.com/api";

async function fetchPage(page: number): Promise<HswTransaction[]> {
  const res = await fetch(`${HSW_BASE}/transactions/page/${page}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HSW page ${page} returned ${res.status}`);
  const data = await res.json() as HswTransaction[] | { transactions?: HswTransaction[] };
  // API returns array or { transactions: [...] } depending on version.
  return Array.isArray(data) ? data : (data.transactions ?? []);
}

export async function runDailyPoliticalTrackerFetch(): Promise<void> {
  console.log("[political-tracker] starting daily fetch");

  let rows: HswTransaction[] = [];
  try {
    // Fetch pages 0 and 1 (up to 2,000 recent transactions).
    const [p0, p1] = await Promise.all([fetchPage(0), fetchPage(1)]);
    rows = [...p0, ...p1];
  } catch (e) {
    console.error("[political-tracker] HSW fetch failed:", e);
    return;
  }

  if (rows.length === 0) {
    console.log("[political-tracker] no rows returned from HSW");
    return;
  }

  const records = rows
    .filter((r) => r.ticker && r.ticker !== "N/A" && r.transaction_date)
    .map((r) => ({
      representative: r.representative?.trim() ?? "Unknown",
      party: r.party?.trim() ?? null,
      state: r.state?.trim() ?? null,
      ticker: r.ticker.toUpperCase().trim(),
      asset_description: r.asset_description?.trim() ?? null,
      asset_type: r.asset_type?.trim() ?? null,
      transaction_type: r.type?.trim() ?? null,
      amount_range: r.amount?.trim() ?? null,
      transaction_date: r.transaction_date,
      filed_at_date: r.filed_at_date ?? null,
      disclosure_date: r.disclosure_date ?? null,
      industry: r.industry?.trim() ?? null,
      sector: r.sector?.trim() ?? null,
      fetched_at: new Date().toISOString(),
    }));

  // Upsert in batches of 200 to avoid payload limits.
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabaseAdmin
      .from("congressional_disclosures")
      .upsert(batch, {
        onConflict: "representative,ticker,transaction_date,filed_at_date",
        ignoreDuplicates: true,
      });
    if (error) {
      console.error(`[political-tracker] upsert batch ${i / BATCH} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`[political-tracker] upserted ${inserted}/${records.length} disclosure rows`);
}
