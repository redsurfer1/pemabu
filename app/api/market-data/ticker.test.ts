import { describe, expect, test, vi, beforeEach } from "vitest";
import { GET } from "./[ticker]/route";

const fetchMarketDataWithFallbackMock = vi.fn();

vi.mock("@/lib/market-data/fetch-market-data", () => ({
  fetchMarketDataWithFallback: (...args: unknown[]) => fetchMarketDataWithFallbackMock(...args),
  normalizeTicker: (ticker: string) => ticker.trim().toUpperCase(),
}));

// withAuth calls createClient() → cookies() which crashes outside Next.js request
// scope. Provide a minimal auth mock that always resolves with a test user.
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: () =>
          Promise.resolve({ data: { user: { id: "test-user-1" } }, error: null }),
      },
    }),
}));

describe("GET /api/market-data/[ticker]", () => {
  beforeEach(() => {
    fetchMarketDataWithFallbackMock.mockReset();
  });

  test("happy path", async () => {
    fetchMarketDataWithFallbackMock.mockResolvedValue({
      ticker: "VEA",
      name: "Vanguard FTSE Developed Markets ETF",
      price1: 48.13,
      price2: 48.09,
      price3: 46.39,
      basisPrice3mo: 46.59,
      basisPrice6mo: 44.61,
      basisPrice1yr: 41.2,
      basisPrice3yr: 37.79,
      basisPrice5yr: 34.27,
      recentCloses: [47.9, 48.01, 48.13],
      volatility3mo: 0.123456,
      currency: "USD",
      fetchedAt: "2026-04-16T10:00:00.000Z",
      provider: "tiingo",
    });

    const res = await GET(new Request("http://localhost/api/market-data/VEA"), {
      params: Promise.resolve({ ticker: "VEA" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ticker: "VEA",
      price1: 48.13,
      basisPrice3mo: 46.59,
      recentCloses: [47.9, 48.01, 48.13],
      volatility3mo: 0.123456,
      fetchedAt: "2026-04-16T10:00:00.000Z",
    });
    expect("error" in body).toBe(false);
    expect(res.headers.get("x-market-data-provider")).toBe("tiingo");
  });

  test("lowercase ticker is forwarded; normalization happens in provider", async () => {
    fetchMarketDataWithFallbackMock.mockImplementation(async (ticker: string) => ({
      ticker,
      name: ticker,
      price1: 1,
      price2: 1,
      price3: 1,
      basisPrice3mo: 1,
      basisPrice6mo: 1,
      basisPrice1yr: 1,
      basisPrice3yr: 1,
      basisPrice5yr: 1,
      recentCloses: [1],
      volatility3mo: null,
      currency: "USD",
      fetchedAt: "2026-04-16T10:00:00.000Z",
      provider: "tiingo",
    }));

    const res = await GET(new Request("http://localhost/api/market-data/vea"), {
      params: Promise.resolve({ ticker: "vea" }),
    });

    expect(fetchMarketDataWithFallbackMock).toHaveBeenCalledWith("VEA");
    expect(res.status).toBe(200);
  });

  test("Tiingo error propagates as 502", async () => {
    fetchMarketDataWithFallbackMock.mockResolvedValue({
      ticker: "VEA",
      name: "VEA",
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
      fetchedAt: "2026-04-16T10:00:00.000Z",
      error: "HTTP 429",
      provider: "tiingo",
    });

    const res = await GET(new Request("http://localhost/api/market-data/VEA"), {
      params: Promise.resolve({ ticker: "VEA" }),
    });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toMatchObject({ error: "HTTP 429" });
  });

  test("empty ticker returns 404", async () => {
    const res = await GET(new Request("http://localhost/api/market-data"), {
      params: Promise.resolve({}),
    });

    expect(res.status).toBe(404);
  });

  test("Tiingo success returns 200 with provider header", async () => {
    fetchMarketDataWithFallbackMock.mockResolvedValue({
      ticker: "VEA",
      name: "VEA",
      price1: 48,
      price2: 47,
      price3: 46,
      basisPrice3mo: 45,
      basisPrice6mo: 44,
      basisPrice1yr: 43,
      basisPrice3yr: 42,
      basisPrice5yr: 41,
      recentCloses: [47, 48],
      volatility3mo: 0.12,
      currency: "USD",
      fetchedAt: "2026-04-16T10:00:00.000Z",
      provider: "tiingo",
    });

    const res = await GET(new Request("http://localhost/api/market-data/VEA"), {
      params: Promise.resolve({ ticker: "VEA" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.provider).toBe("tiingo");
    expect(res.headers.get("x-market-data-provider")).toBe("tiingo");
  });

  test("Tiingo not found returns 502", async () => {
    fetchMarketDataWithFallbackMock.mockResolvedValue({
      ticker: "FAKEXYZ",
      name: "FAKEXYZ",
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
      fetchedAt: "2026-04-16T10:00:00.000Z",
      error: "HTTP 404",
      provider: "tiingo",
    });

    const res = await GET(new Request("http://localhost/api/market-data/FAKEXYZ"), {
      params: Promise.resolve({ ticker: "FAKEXYZ" }),
    });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toContain("404");
    expect(body.provider).toBe("tiingo");
  });

  test("Tiingo upstream error returns 502", async () => {
    fetchMarketDataWithFallbackMock.mockResolvedValue({
      ticker: "VEA",
      name: "VEA",
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
      fetchedAt: "2026-04-16T10:00:00.000Z",
      error: "Tiingo HTTP 503",
      provider: "tiingo",
    });

    const res = await GET(new Request("http://localhost/api/market-data/VEA"), {
      params: Promise.resolve({ ticker: "VEA" }),
    });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toContain("503");
    expect(body.provider).toBe("tiingo");
  });
});
