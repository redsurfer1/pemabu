import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTiingoDailyCloses } from "./tiingo-daily-closes";

describe("fetchTiingoDailyCloses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns equity adjClose series from Tiingo daily prices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { date: "2025-01-02", adjClose: 100 },
          { date: "2025-01-03", adjClose: 101 },
          { date: "2025-01-06", adjClose: 102 },
        ],
      }),
    );

    const closes = await fetchTiingoDailyCloses("SPY", {
      startDate: "2025-01-01",
      token: "test-token",
    });

    expect(closes).toEqual([100, 101, 102]);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/tiingo/daily/SPY/prices");
    expect(url).toContain("startDate=2025-01-01");
  });

  it("returns crypto close series for BTC-USD", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            priceData: [
              { date: "2025-01-02", close: 42000 },
              { date: "2025-01-03", close: 43000 },
            ],
          },
        ],
      }),
    );

    const closes = await fetchTiingoDailyCloses("BTC-USD", {
      startDate: "2025-01-01",
      token: "test-token",
    });

    expect(closes).toEqual([42000, 43000]);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/tiingo/crypto/prices");
    expect(url).toContain("tickers=btcusd");
  });

  it("returns empty array on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    const closes = await fetchTiingoDailyCloses("GLD", { token: "bad" });
    expect(closes).toEqual([]);
  });
});
