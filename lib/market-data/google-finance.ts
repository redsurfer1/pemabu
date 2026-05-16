// lib/market-data/google-finance.ts
// BETA ONLY — replace with Marketstack pre-launch.
// No API key. Sequential fetch with delay.
// ToS: not licensed for commercial redistribution.
// Approved for private beta and internal testing only.

import type {
  MarketDataProvider,
  Quote,
  QuoteBatchResult,
  QuoteErrorKind,
} from "./types";
import { normalizeTicker } from "./yahoo-finance";

const DELAY_MS = 200;
const TIMEOUT_MS = 8000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGoogleFinanceQuote(ticker: string): Promise<Quote | null> {
  // CASH is always $1.00 — never hit the network for it
  if (ticker === "CASH") {
    return {
      ticker: "CASH",
      price: 1.00,
      change: 0,
      changePercent: 0,
      currency: "USD",
      asOf: new Date(),
      source: "fixed",
    };
  }

  // Normalize crypto tickers (BTC → BTC-USD) before fetching
  const normalizedTicker = normalizeTicker(ticker);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Yahoo Finance chart endpoint (labelled "google-finance" for historical reasons — see AUDIT_REPORT.md)
    const url =
      `https://query1.finance.yahoo.com/v8/finance/` +
      `chart/${encodeURIComponent(normalizedTicker)}` +
      `?interval=1d&range=1d`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      chart?: { result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          previousClose?: number;
          currency?: string;
          regularMarketTime?: number;
          exchangeName?: string;
        };
      }> };
    };
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? price;

    if (price == null) return null;

    const change = price - (prevClose ?? price);
    const changePercent = prevClose ? (change / prevClose) * 100 : 0;

    const marketTimeSec = meta?.regularMarketTime ?? Math.floor(Date.now() / 1000);

    return {
      ticker: ticker.toUpperCase(),
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      currency: meta?.currency ?? "USD",
      asOf: new Date(marketTimeSec * 1000),
      source: "google-finance",
      exchange: meta?.exchangeName,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const googleFinanceProvider: MarketDataProvider = {
  id: "google-finance",
  batchSize: 1, // Sequential — no batch endpoint

  async getQuote(ticker): Promise<Quote | null> {
    return fetchGoogleFinanceQuote(ticker);
  },

  async getQuotes(tickers): Promise<QuoteBatchResult> {
    const quotes: Quote[] = [];
    const errors: QuoteBatchResult["errors"] = [];

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i]!;
      const quote = await fetchGoogleFinanceQuote(ticker);
      if (quote) {
        quotes.push(quote);
      } else {
        errors.push({
          ticker,
          kind: "not_found" as QuoteErrorKind,
          message: `No data returned for ${ticker}`,
        });
      }
      if (i < tickers.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    return { quotes, errors };
  },

  async healthCheck() {
    const start = Date.now();
    const quote = await fetchGoogleFinanceQuote("SPY");
    const latencyMs = Date.now() - start;
    return {
      ok: quote !== null,
      provider: "google-finance",
      latencyMs,
      message: quote ? undefined : "SPY health check returned no data",
    };
  },
};
