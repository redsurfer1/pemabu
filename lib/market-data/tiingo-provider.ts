import { cashMarketDataResult, type MarketDataResult } from "./market-data-result";
import { fetchMarketDataTiingo } from "./tiingo";
import { normalizeTicker } from "./normalize-ticker";
import type { MarketDataProvider, Quote, QuoteBatchResult, QuoteErrorKind } from "./types";

const DELAY_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapToQuote(ticker: string, md: MarketDataResult): Quote | null {
  if (md.price1 <= 0) return null;
  const change = md.price1 - md.price2;
  const changePercent = md.price2 > 0 ? (change / md.price2) * 100 : 0;
  return {
    ticker: md.ticker,
    price: Math.round(md.price1 * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    currency: md.currency,
    asOf: new Date(md.fetchedAt),
    source: "tiingo",
  };
}

async function fetchTiingoQuote(ticker: string): Promise<Quote | null> {
  const upper = normalizeTicker(ticker);
  if (upper === "CASH") {
    return mapToQuote(upper, cashMarketDataResult(upper));
  }

  const md = await fetchMarketDataTiingo(upper);
  if (md.error) return null;
  return mapToQuote(upper, md);
}

export const tiingoProvider: MarketDataProvider = {
  id: "tiingo",
  batchSize: 1,

  async getQuote(ticker): Promise<Quote | null> {
    return fetchTiingoQuote(ticker);
  },

  async getQuotes(tickers): Promise<QuoteBatchResult> {
    const quotes: Quote[] = [];
    const errors: QuoteBatchResult["errors"] = [];

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i]!;
      const quote = await fetchTiingoQuote(ticker);
      if (quote) {
        quotes.push(quote);
      } else {
        errors.push({
          ticker,
          kind: "not_found" as QuoteErrorKind,
          message: `No Tiingo data for ${ticker}`,
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
    const quote = await fetchTiingoQuote("SPY");
    const latencyMs = Date.now() - start;
    return {
      ok: quote !== null,
      provider: "tiingo",
      latencyMs,
      message: quote ? undefined : "SPY health check returned no Tiingo data — verify TIINGO_API_KEY",
    };
  },
};
