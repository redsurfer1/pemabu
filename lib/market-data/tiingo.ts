import { env } from "@/lib/env";
import { computeRSI } from "@/lib/portfolio/formula-engine";
import type { MarketDataResult } from "@/lib/market-data/yahoo-finance";

type TiingoMetaResponse = {
  ticker?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
};

type TiingoPriceRow = {
  date: string;
  close?: number | null;
  adjClose?: number | null;
};

function pickClosestClose(history: Array<{ tsMs: number; close: number }>, targetMs: number): number {
  let best = history[0]!;
  let bestDiff = Math.abs(best.tsMs - targetMs);
  for (let i = 1; i < history.length; i++) {
    const row = history[i]!;
    const d = Math.abs(row.tsMs - targetMs);
    if (d < bestDiff) {
      bestDiff = d;
      best = row;
    }
  }
  return best.close;
}

function computeVolatilityAnnualized(closes: number[]): number | null {
  if (closes.length < 64) return null;
  const recent = closes.slice(-63);
  const logReturns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1]!;
    const next = recent[i]!;
    if (prev > 0 && next > 0) {
      logReturns.push(Math.log(next / prev));
    }
  }
  if (logReturns.length < 2) return null;
  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (logReturns.length - 1);
  const stddev = Math.sqrt(variance);
  return Math.round(stddev * Math.sqrt(252) * 1_000_000) / 1_000_000;
}

function dateStrToUtcMs(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00.000Z`).getTime();
}

function startDateFiveYearsAgo(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

export async function fetchMarketDataTiingo(ticker: string): Promise<MarketDataResult> {
  const upper = ticker.trim().toUpperCase();
  const nowIso = new Date().toISOString();
  const empty: MarketDataResult = {
    ticker: upper,
    name: upper,
    price1: 0,
    price2: 0,
    price3: 0,
    basisPrice3mo: 0,
    basisPrice6mo: 0,
    basisPrice1yr: 0,
    basisPrice3yr: 0,
    basisPrice5yr: 0,
    recentCloses: [],
    volatility3mo: null,
    currency: "USD",
    fetchedAt: nowIso,
  };

  const token = env.TIINGO_API_KEY;
  const headers: HeadersInit = {
    Authorization: `Token ${token}`,
    "Content-Type": "application/json",
  };

  let name = upper;
  try {
    const metaRes = await fetch(`https://api.tiingo.com/tiingo/daily/${encodeURIComponent(upper)}`, {
      headers,
    });
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as TiingoMetaResponse;
      if (meta?.name && String(meta.name).trim()) {
        name = String(meta.name);
      }
    }
  } catch {
    /* use ticker as name */
  }

  try {
    const startDate = startDateFiveYearsAgo();
    const pricesUrl =
      `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(upper)}/prices` +
      `?startDate=${encodeURIComponent(startDate)}&resampleFreq=daily`;
    const pricesRes = await fetch(pricesUrl, { headers });
    if (!pricesRes.ok) {
      return { ...empty, name, error: `Tiingo HTTP ${pricesRes.status}` };
    }
    const rawRows = (await pricesRes.json()) as TiingoPriceRow[];
    if (!Array.isArray(rawRows)) {
      return { ...empty, name, error: "Tiingo prices response invalid" };
    }

    const history = rawRows
      .map((row) => {
        const adj = row.adjClose;
        if (adj == null || !Number.isFinite(adj)) return null;
        return { tsMs: dateStrToUtcMs(row.date), close: adj };
      })
      .filter((x): x is { tsMs: number; close: number } => x != null)
      .sort((a, b) => a.tsMs - b.tsMs);

    if (history.length < 2) {
      return { ...empty, name, error: "Tiingo returned fewer than 2 usable adjClose rows" };
    }

    const closes = history.map((h) => h.close);
    const current = history[history.length - 1]!;
    const nowMs = current.tsMs;

    const price1 = current.close;
    const price2 = pickClosestClose(history, nowMs - 1 * 24 * 3600 * 1000);
    const price3 = pickClosestClose(history, nowMs - 7 * 24 * 3600 * 1000);
    const basisPrice3mo = pickClosestClose(history, nowMs - 91 * 24 * 3600 * 1000);
    const basisPrice6mo = pickClosestClose(history, nowMs - 183 * 24 * 3600 * 1000);
    const basisPrice1yr = pickClosestClose(history, nowMs - 365 * 24 * 3600 * 1000);
    const basisPrice3yr = pickClosestClose(history, nowMs - 1095 * 24 * 3600 * 1000);
    const basisPrice5yr = pickClosestClose(history, nowMs - 1825 * 24 * 3600 * 1000);

    const recentCloses = closes.slice(-40);
    const volatility3mo = computeVolatilityAnnualized(closes);
    void computeRSI(recentCloses);

    return {
      ticker: upper,
      name,
      price1,
      price2,
      price3,
      basisPrice3mo,
      basisPrice6mo,
      basisPrice1yr,
      basisPrice3yr,
      basisPrice5yr,
      recentCloses,
      volatility3mo,
      currency: "USD",
      fetchedAt: nowIso,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ...empty, name, error: message };
  }
}
