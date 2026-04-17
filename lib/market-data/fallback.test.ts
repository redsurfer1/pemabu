import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MarketDataResult } from "./yahoo-finance";
import { fetchMarketDataWithFallback } from "./yahoo-finance";

const tiingoMock = vi.hoisted(() => vi.fn());

vi.mock("./tiingo", () => ({
  fetchMarketDataTiingo: (...args: unknown[]) => tiingoMock(...args),
}));

/** Enough daily points for volatility (needs 64+ closes). */
function makeYahooChartPayload(symbol: string, lastClose = 100) {
  const n = 70;
  const base = Math.floor(Date.now() / 1000);
  const timestamps: number[] = [];
  const closes: number[] = [];
  for (let i = 0; i < n; i++) {
    timestamps.push(base - (n - 1 - i) * 86400);
    closes.push(lastClose - (n - 1 - i) * 0.01);
  }
  return {
    chart: {
      result: [
        {
          meta: { shortName: symbol, currency: "USD", symbol },
          timestamp: timestamps,
          indicators: { quote: [{ close: closes }] },
        },
      ],
    },
  };
}

function baseTiingoOk(overrides: Partial<MarketDataResult> = {}): MarketDataResult {
  return {
    ticker: "VEA",
    name: "VEA",
    price1: 99,
    price2: 98,
    price3: 97,
    basisPrice3mo: 90,
    basisPrice6mo: 85,
    basisPrice1yr: 80,
    basisPrice3yr: 75,
    basisPrice5yr: 70,
    recentCloses: [97, 98, 99],
    volatility3mo: 0.11,
    currency: "USD",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("fetchMarketDataWithFallback", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tiingoMock.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("Yahoo success, Tiingo never called", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(makeYahooChartPayload("VEA", 68.5)), { status: 200 }),
    );

    const result = await fetchMarketDataWithFallback("VEA");

    expect(tiingoMock).not.toHaveBeenCalled();
    expect(result.provider).toBe("yahoo");
    expect(result.error).toBeUndefined();
    expect(result.ticker).toBe("VEA");
    expect(result.price1).toBeCloseTo(68.5, 0);
  });

  test("Yahoo 429, Tiingo called and succeeds", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    tiingoMock.mockResolvedValue(baseTiingoOk({ price1: 99 }));

    const result = await fetchMarketDataWithFallback("VEA");

    expect(tiingoMock).toHaveBeenCalledTimes(1);
    expect(tiingoMock).toHaveBeenCalledWith("VEA");
    expect(result.provider).toBe("tiingo");
    expect(result.price1).toBe(99);
  });

  test("Yahoo 500, Tiingo called and succeeds", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 500 }));
    tiingoMock.mockResolvedValue(baseTiingoOk({ price1: 42 }));

    const result = await fetchMarketDataWithFallback("VEA");

    expect(result.provider).toBe("tiingo");
    expect(result.price1).toBe(42);
  });

  test("Yahoo 404, Tiingo NOT called (bad ticker, not a transient error)", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 404 }));

    const result = await fetchMarketDataWithFallback("FAKEXYZ");

    expect(tiingoMock).not.toHaveBeenCalled();
    expect(result.provider).toBe("yahoo");
    expect(result.error).toContain("404");
  });

  test("Yahoo timeout string triggers fallback", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed: ECONNRESET"));
    tiingoMock.mockResolvedValue(baseTiingoOk({ price1: 7 }));

    const result = await fetchMarketDataWithFallback("VEA");

    expect(result.provider).toBe("tiingo");
    expect(result.price1).toBe(7);
  });

  test("Both providers fail, combined error returned", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 429 }));
    tiingoMock.mockResolvedValue({ ...baseTiingoOk(), error: "HTTP 503" });

    const result = await fetchMarketDataWithFallback("VEA");

    expect(result.error).toBe("Yahoo: Yahoo HTTP 429 | Tiingo: HTTP 503");
    expect(result.provider).toBe("yahoo");
  });
});
