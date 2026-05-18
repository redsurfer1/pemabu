import {
  computePositionSentiment,
  type PositionSentiment,
} from "@/lib/intelligence/position-sentiment";

const SEC_USER_AGENT = "Pemabu Platform contact@pemabu.com";

export type ThirteenFSentiment = PositionSentiment;

export interface ThirteenFFilingRow {
  filer: string | null;
  period: string | null;
  filed: string | null;
  cik: string | null;
  shares: number | null;
  priorShares: number | null;
  sentiment: ThirteenFSentiment;
}

interface EdgarSource {
  period_ending?: string;
  period_of_report?: string;
  display_names?: string[];
  file_date?: string;
  form?: string;
  adsh?: string;
  ciks?: string[];
}

interface EdgarHit {
  _id?: string;
  _source?: EdgarSource;
}

interface ParsedFiling {
  filer: string;
  period: string;
  filed: string | null;
  cik: string;
  adsh: string;
  filename: string;
}

export function computeThirteenFSentiment(
  currentShares: number | null,
  priorShares: number | null,
): ThirteenFSentiment {
  return computePositionSentiment(currentShares, priorShares);
}

export function parseSharesFrom13FXml(xml: string, ticker: string): number | null {
  const target = ticker.toUpperCase();
  const blocks = xml.split(/<[^>]*infoTable>/i).slice(1);

  for (const block of blocks) {
    const classMatch = block.match(/<[^:]*:?titleOfClass>\s*([^<]+?)\s*<\/[^:]*:?titleOfClass>/i);
    if (!classMatch) continue;
    if (classMatch[1]!.trim().toUpperCase() !== target) continue;

    const sharesMatch = block.match(/<[^:]*:?sshPrnamt>\s*([\d,]+)\s*<\/[^:]*:?sshPrnamt>/i);
    if (!sharesMatch) return null;
    const shares = Number(sharesMatch[1]!.replace(/,/g, ""));
    return Number.isFinite(shares) ? shares : null;
  }

  return null;
}

function parseHitId(hitId: string): { adsh: string; filename: string } | null {
  const idx = hitId.indexOf(":");
  if (idx <= 0) return null;
  return { adsh: hitId.slice(0, idx), filename: hitId.slice(idx + 1) };
}

function normalizeFiler(displayName: string | null | undefined): string | null {
  if (!displayName) return null;
  return displayName.replace(/\s*\(CIK\s*\d+\)\s*$/i, "").trim() || null;
}

function cikToPath(cik: string): string {
  return String(parseInt(cik, 10));
}

function adshToFolder(adsh: string): string {
  return adsh.replace(/-/g, "");
}

function parseSearchHits(hits: EdgarHit[]): ParsedFiling[] {
  const seen = new Set<string>();
  const filings: ParsedFiling[] = [];

  for (const hit of hits) {
    const src = hit._source;
    if (!src || src.form !== "13F-HR") continue;

    const period = src.period_ending ?? src.period_of_report;
    const cik = src.ciks?.[0];
    const adsh = src.adsh;
    const fileParts = hit._id ? parseHitId(hit._id) : null;
    const filer = normalizeFiler(src.display_names?.[0]);

    if (!period || !cik || !adsh || !fileParts || !filer) continue;
    if (fileParts.adsh !== adsh) continue;

    const key = `${cik}|${period}`;
    if (seen.has(key)) continue;
    seen.add(key);

    filings.push({
      filer,
      period,
      filed: src.file_date ?? null,
      cik,
      adsh,
      filename: fileParts.filename,
    });
  }

  return filings;
}

async function fetchFilingXml(cik: string, adsh: string, filename: string): Promise<string | null> {
  const url = `https://www.sec.gov/Archives/edgar/data/${cikToPath(cik)}/${adshToFolder(adsh)}/${encodeURIComponent(filename)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": SEC_USER_AGENT },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function buildThirteenFOverlayRows(
  hits: EdgarHit[],
  ticker: string,
): Promise<ThirteenFFilingRow[]> {
  const parsed = parseSearchHits(hits);
  if (parsed.length === 0) return [];

  const withShares = await mapPool(parsed, 4, async (f) => {
    const xml = await fetchFilingXml(f.cik, f.adsh, f.filename);
    const shares = xml ? parseSharesFrom13FXml(xml, ticker) : null;
    return { ...f, shares };
  });

  const byCik = new Map<string, Array<(typeof withShares)[number]>>();
  for (const row of withShares) {
    const list = byCik.get(row.cik) ?? [];
    list.push(row);
    byCik.set(row.cik, list);
  }

  for (const list of byCik.values()) {
    list.sort((a, b) => a.period.localeCompare(b.period));
  }

  const rows: ThirteenFFilingRow[] = [];

  for (const list of byCik.values()) {
    for (let i = 0; i < list.length; i++) {
      const cur = list[i]!;
      const prior = i > 0 ? list[i - 1]! : null;
      const priorShares = prior?.shares ?? null;
      rows.push({
        filer: cur.filer,
        period: cur.period,
        filed: cur.filed,
        cik: cur.cik,
        shares: cur.shares,
        priorShares,
        sentiment: computePositionSentiment(cur.shares, priorShares),
      });
    }
  }

  rows.sort((a, b) => {
    const periodCmp = (b.period ?? "").localeCompare(a.period ?? "");
    if (periodCmp !== 0) return periodCmp;
    return (a.filer ?? "").localeCompare(b.filer ?? "");
  });

  return rows.slice(0, 30);
}

export function getThirteenFSearchStartDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 24);
  return d.toISOString().split("T")[0]!;
}

export async function searchEdgarThirteenF(ticker: string): Promise<EdgarHit[]> {
  const res = await fetch(
    `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&dateRange=custom&startdt=${getThirteenFSearchStartDate()}&forms=13F-HR`,
    { headers: { "User-Agent": SEC_USER_AGENT }, signal: AbortSignal.timeout(12_000) },
  );

  if (!res.ok) return [];

  const raw = (await res.json()) as { hits?: { hits?: EdgarHit[] } };
  return raw.hits?.hits ?? [];
}
