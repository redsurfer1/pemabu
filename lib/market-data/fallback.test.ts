import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MarketDataResult } from "./market-data-result";
import { fetchMarketDataWithFallback } from "./fetch-market-data";

const tiingoMock = vi.hoisted(() => vi.fn());

vi.mock("./tiingo", () => ({
  fetchMarketDataTiingo: (...args: unknown[]) => tiingoMock(...args),
}));

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

describe("fetchMarketDataWithFallback (Tiingo)", () => {
  beforeEach(() => {
    tiingoMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("CASH returns fixed $1 without calling Tiingo", async () => {
    const result = await fetchMarketDataWithFallback("CASH");
    expect(tiingoMock).not.toHaveBeenCalled();
    expect(result.provider).toBe("tiingo");
    expect(result.price1).toBe(1);
    expect(result.error).toBeUndefined();
  });

  test("equity ticker uses Tiingo", async () => {
    tiingoMock.mockResolvedValue(baseTiingoOk({ price1: 48.13 }));
    const result = await fetchMarketDataWithFallback("VEA");
    expect(tiingoMock).toHaveBeenCalledWith("VEA", { token: undefined });
    expect(result.provider).toBe("tiingo");
    expect(result.price1).toBe(48.13);
    expect(result.error).toBeUndefined();
  });

  test("crypto ticker normalized to BTC-USD", async () => {
    tiingoMock.mockResolvedValue(baseTiingoOk({ ticker: "BTC-USD", price1: 77000 }));
    const result = await fetchMarketDataWithFallback("BTC");
    expect(tiingoMock).toHaveBeenCalledWith("BTC-USD", { token: undefined });
    expect(result.provider).toBe("tiingo");
    expect(result.ticker).toBe("BTC-USD");
  });

  test("portfolio Tiingo token forwarded", async () => {
    tiingoMock.mockResolvedValue(baseTiingoOk());
    await fetchMarketDataWithFallback("VEA", { tiingoToken: "portfolio-token" });
    expect(tiingoMock).toHaveBeenCalledWith("VEA", { token: "portfolio-token" });
  });

  test("Tiingo error surfaces on result", async () => {
    tiingoMock.mockResolvedValue({ ...baseTiingoOk(), error: "Tiingo HTTP 404" });
    const result = await fetchMarketDataWithFallback("FAKEXYZ");
    expect(result.provider).toBe("tiingo");
    expect(result.error).toContain("404");
  });
});
