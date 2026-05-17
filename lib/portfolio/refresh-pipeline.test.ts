import { describe, expect, test, vi, beforeEach } from "vitest";

// refresh-portfolio-signals.ts starts with `import "server-only"` which is a
// Next.js build-time guard that has no runtime implementation in the vitest
// node environment. Mock the package so the test can import the module.
vi.mock("server-only", () => ({}));

// refreshPortfolioSignals dynamically imports portfolio-assumptions-store,
// which calls createClient() → cookies() (crashes outside request scope).
// Mock it to return null so the fallback to DEFAULT_ASSUMPTIONS triggers,
// which is the exact scenario all tests in this file exercise.
vi.mock("@/lib/portfolio/portfolio-assumptions-store", () => ({
  getPortfolioAssumptions: () => Promise.resolve(null),
}));

// getPortfolioTiingoToken queries portfolio_api_credentials — no custom
// token in tests; returning null causes the global env token to be used.
vi.mock("@/lib/portfolio/api-credentials", () => ({
  getPortfolioTiingoToken: () => Promise.resolve(null),
}));

// Prevent createClient from calling cookies() if imported by any other path.
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }) },
      from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
    }),
}));

import { refreshPortfolioSignals } from "@/lib/allocation/refresh-portfolio-signals";
import { DEFAULT_ASSUMPTIONS, colAB, colV, colW, colX, colY, colZ } from "@/lib/portfolio/formula-engine";

const fetchMarketDataMock = vi.fn();

vi.mock("@/lib/market-data/yahoo-finance", () => ({
  fetchMarketData: (...args: unknown[]) => fetchMarketDataMock(...args),
  fetchMarketDataWithFallback: (...args: unknown[]) => fetchMarketDataMock(...args),
  // fetchMarketDataCached is the call site used in refresh-portfolio-signals.ts.
  // Forward to the same mock so tests can configure it per test case.
  fetchMarketDataCached: (...args: unknown[]) => fetchMarketDataMock(...args),
  // clearPriceCache is called at the start of refreshPortfolioSignals; no-op in tests.
  clearPriceCache: () => {},
}));

type MockHolding = {
  id: string;
  portfolio_id: string;
  ticker: string;
  name: string | null;
  quantity: number;
  expense_ratio: number | null;
  dividend_dollars: number | null;
  target_parity_weight: number | null;
};

function createSupabaseMock({
  holdings,
  assumptions,
}: {
  holdings: MockHolding[];
  assumptions: Record<string, number> | null;
}) {
  const upsertMock = vi.fn().mockResolvedValue({ error: null });

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "portfolio_holdings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: holdings, error: null }),
            })),
          })),
          upsert: upsertMock,
        };
      }

      if (table === "portfolio_assumptions") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: assumptions, error: null }),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return { supabase, upsertMock };
}

function okMarketData(ticker: string, price1: number) {
  return {
    ticker,
    name: ticker,
    price1,
    price2: price1 - 0.25,
    price3: price1 - 0.5,
    basisPrice3mo: price1 - 2,
    basisPrice6mo: price1 - 4,
    basisPrice1yr: price1 - 6,
    basisPrice3yr: price1 - 8,
    basisPrice5yr: price1 - 10,
    recentCloses: Array.from({ length: 20 }, (_, i) => price1 - i * 0.1),
    volatility3mo: 0.1234,
    currency: "USD",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("refreshPortfolioSignals pipeline", () => {
  beforeEach(() => {
    fetchMarketDataMock.mockReset();
  });

  test("refreshPortfolioSignals — happy path", async () => {
    const holdings: MockHolding[] = [
      { id: "h1", portfolio_id: "p1", ticker: "AAA", name: "AAA", quantity: 10, expense_ratio: 0.001, dividend_dollars: 10, target_parity_weight: 0.1 },
      { id: "h2", portfolio_id: "p1", ticker: "BBB", name: "BBB", quantity: 20, expense_ratio: 0.002, dividend_dollars: 20, target_parity_weight: 0.2 },
      { id: "h3", portfolio_id: "p1", ticker: "CCC", name: "CCC", quantity: 30, expense_ratio: 0.003, dividend_dollars: 30, target_parity_weight: 0.3 },
    ];
    const { supabase, upsertMock } = createSupabaseMock({ holdings, assumptions: null });

    fetchMarketDataMock
      .mockResolvedValueOnce(okMarketData("AAA", 100))
      .mockResolvedValueOnce(okMarketData("BBB", 50))
      .mockResolvedValueOnce(okMarketData("CCC", 25));

    await refreshPortfolioSignals("p1", supabase as never);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertPayload = upsertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(upsertPayload).toHaveLength(3);
    upsertPayload.forEach((row) => {
      expect(row.rank_overall).not.toBeNull();
      expect(row.alert_primary).toBeTypeOf("string");
      expect(row.target_sleeve_pct).not.toBeNull();
      expect(row.last_market_refresh).toBeTypeOf("string");
    });
  });

  test("refreshPortfolioSignals — partial market data failure", async () => {
    const holdings: MockHolding[] = [
      { id: "h1", portfolio_id: "p1", ticker: "AAA", name: "AAA", quantity: 10, expense_ratio: 0.001, dividend_dollars: 10, target_parity_weight: 0.1 },
      { id: "h2", portfolio_id: "p1", ticker: "BBB", name: "BBB", quantity: 20, expense_ratio: 0.002, dividend_dollars: 20, target_parity_weight: 0.2 },
      { id: "h3", portfolio_id: "p1", ticker: "CCC", name: "CCC", quantity: 30, expense_ratio: 0.003, dividend_dollars: 30, target_parity_weight: 0.3 },
    ];
    const { supabase, upsertMock } = createSupabaseMock({ holdings, assumptions: null });

    fetchMarketDataMock
      .mockResolvedValueOnce(okMarketData("AAA", 100))
      .mockResolvedValueOnce({ ...okMarketData("BBB", 0), error: "timeout" })
      .mockResolvedValueOnce(okMarketData("CCC", 25));

    await refreshPortfolioSignals("p1", supabase as never);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertPayload = upsertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(upsertPayload).toHaveLength(3);

    const okRows = upsertPayload.filter((row) => row.id !== "h2");
    okRows.forEach((row) => {
      expect(row.price_current).not.toBeNull();
      expect(row.return_weighted_avg).not.toBeNull();
    });

    const failed = upsertPayload.find((row) => row.id === "h2");
    expect(failed).toBeTruthy();
    expect(failed?.price_current).toBeNull();
    expect(failed?.change_24h).toBeNull();
    expect(failed?.change_7d).toBeNull();
    expect(failed?.return_3mo).toBeNull();
    expect(failed?.return_6mo).toBeNull();
    expect(failed?.return_1yr).toBeNull();
    expect(failed?.return_3yr).toBeNull();
    expect(failed?.return_5yr).toBeNull();
    expect(failed?.return_avg).toBeNull();
    expect(failed?.return_weighted_avg).toBeNull();
    expect(failed?.target_sleeve_pct).toBeNull();
    expect(failed?.parity_dollars).toBeNull();
    expect(failed?.parity_change_dollars).toBeNull();
    expect(failed?.shares_delta).toBeNull();
    expect(failed?.alert_primary).toBeNull();
    expect(failed?.alert_secondary).toBeNull();
    expect(failed?.rsi_14).toBeNull();
  });

  test("refreshPortfolioSignals — empty portfolio", async () => {
    const { supabase, upsertMock } = createSupabaseMock({ holdings: [], assumptions: null });

    await expect(refreshPortfolioSignals("p1", supabase as never)).resolves.toBeUndefined();
    expect(fetchMarketDataMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test("refreshPortfolioSignals — assumptions fallback", async () => {
    const holdings: MockHolding[] = [
      { id: "h1", portfolio_id: "p1", ticker: "AAA", name: "AAA", quantity: 10, expense_ratio: 0.001, dividend_dollars: 10, target_parity_weight: 0.1 },
    ];
    const { supabase, upsertMock } = createSupabaseMock({ holdings, assumptions: null });

    const md = okMarketData("AAA", 100);
    fetchMarketDataMock.mockResolvedValueOnce(md);

    await refreshPortfolioSignals("p1", supabase as never);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertPayload = upsertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    const row = upsertPayload[0]!;
    const expected = colAB(
      colV(md.price1, md.basisPrice3mo),
      colW(md.price1, md.basisPrice6mo),
      colX(md.price1, md.basisPrice1yr),
      colY(md.price1, md.basisPrice3yr),
      colZ(md.price1, md.basisPrice5yr),
      DEFAULT_ASSUMPTIONS.return_weights,
    );
    expect(row.return_weighted_avg).toBeCloseTo(expected, 6);
  });
});
