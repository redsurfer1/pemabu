// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_ASSUMPTIONS, type Assumptions } from "@/lib/portfolio/formula-engine";
import { usePortfolioEngine } from "@/lib/portfolio/use-portfolio-engine";

const getSupabaseBrowserClientMock = vi.fn();
const upsertMock = vi.fn();
const removeChannelMock = vi.fn();

let lastSubscribeCb: ((status: string) => void) | undefined;
let lastRealtimeHandler:
  | ((payload: {
      eventType: string;
      new?: Record<string, unknown>;
      old?: Record<string, unknown>;
    }) => void)
  | undefined;

const channelMock = {
  on: vi.fn((_event: string, _filter: unknown, handler: typeof lastRealtimeHandler) => {
    lastRealtimeHandler = handler;
    return channelMock;
  }),
  subscribe: vi.fn((cb?: (status: string) => void) => {
    lastSubscribeCb = cb;
    return channelMock;
  }),
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: (...args: unknown[]) => getSupabaseBrowserClientMock(...args),
}));

function makeHoldingRow(id: string, ticker: string, marketValue: number, refreshedAt: string | null = null) {
  return {
    id,
    portfolio_id: "p1",
    ticker,
    name: ticker,
    quantity: 1,
    market_value: marketValue,
    expense_ratio: 0.001,
    dividend_dollars: 0,
    target_parity_weight: 0.2,
    return_3mo: 0.03,
    return_6mo: 0.08,
    return_1yr: 0.16,
    return_3yr: 0.27,
    return_5yr: 0.4,
    sub_rank_expense: 2,
    sub_rank_weighted_ret: 2,
    sub_rank_div_apy: 2,
    sub_rank_volatility: 2,
    last_market_refresh: refreshedAt,
  };
}

describe("usePortfolioEngine", () => {
  let holdingsData: Array<Record<string, unknown>>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    lastSubscribeCb = undefined;
    lastRealtimeHandler = undefined;
    channelMock.on.mockClear();
    channelMock.subscribe.mockClear();
    removeChannelMock.mockReset();

    holdingsData = [
      makeHoldingRow("h1", "VEA", 100),
      makeHoldingRow("h2", "VWO", 200),
      makeHoldingRow("h3", "BND", 300),
    ];

    upsertMock.mockResolvedValue({ error: null });
    getSupabaseBrowserClientMock.mockReturnValue({
      from: vi.fn(() => ({
        upsert: upsertMock,
      })),
      channel: vi.fn(() => channelMock),
      removeChannel: removeChannelMock,
    });

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.startsWith("/api/workbook/holdings?portfolioId=") && method === "GET") {
        return new Response(JSON.stringify({ holdings: holdingsData }), { status: 200 });
      }

      if (url.startsWith("/api/portfolio/p1/refresh") && method === "POST") {
        return new Response(
          JSON.stringify({ success: true, refreshedAt: "2025-01-01T00:00:00.000Z" }),
          { status: 200 },
        );
      }

      if (url.startsWith("/api/workbook/holdings/") && method === "DELETE") {
        const id = url.split("/").at(-1);
        holdingsData = holdingsData.filter((h) => String(h.id) !== id);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      if (url === "/api/workbook/holdings" && method === "POST") {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }

      return new Response(JSON.stringify({ error: `Unhandled fetch ${method} ${url}` }), { status: 500 });
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  test("normaliseWeights called before DB write", async () => {
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(3));

    const input: Assumptions = {
      return_weights: { r3mo: 2, r6mo: 2, r1yr: 2, r3yr: 2, r5yr: 2 },
      factor_weights: { ...DEFAULT_ASSUMPTIONS.factor_weights },
    };

    await act(async () => {
      await result.current.updateAssumptions(input);
    });

    const payload = upsertMock.mock.calls[0]?.[0] as Record<string, number>;
    expect(payload.weight_3mo).toBeCloseTo(0.2, 6);
    expect(payload.weight_6mo).toBeCloseTo(0.2, 6);
    expect(payload.weight_1yr).toBeCloseTo(0.2, 6);
    expect(payload.weight_3yr).toBeCloseTo(0.2, 6);
    expect(payload.weight_5yr).toBeCloseTo(0.2, 6);

    expect(result.current.assumptions.return_weights.r3mo).toBeCloseTo(0.2, 6);
    expect(result.current.assumptions.return_weights.r6mo).toBeCloseTo(0.2, 6);
    expect(result.current.assumptions.return_weights.r1yr).toBeCloseTo(0.2, 6);
    expect(result.current.assumptions.return_weights.r3yr).toBeCloseTo(0.2, 6);
    expect(result.current.assumptions.return_weights.r5yr).toBeCloseTo(0.2, 6);
  });

  test("already-normalised weights pass through unchanged", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(3));

    await act(async () => {
      await result.current.updateAssumptions(DEFAULT_ASSUMPTIONS);
    });

    const payload = upsertMock.mock.calls[0]?.[0] as Record<string, number>;
    expect(payload.weight_3mo).toBe(DEFAULT_ASSUMPTIONS.return_weights.r3mo);
    expect(payload.weight_6mo).toBe(DEFAULT_ASSUMPTIONS.return_weights.r6mo);
    expect(payload.weight_1yr).toBe(DEFAULT_ASSUMPTIONS.return_weights.r1yr);
    expect(payload.weight_3yr).toBe(DEFAULT_ASSUMPTIONS.return_weights.r3yr);
    expect(payload.weight_5yr).toBe(DEFAULT_ASSUMPTIONS.return_weights.r5yr);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("refreshSignals calls POST refresh endpoint", async () => {
    holdingsData = [
      makeHoldingRow("h1", "VEA", 100, "2025-01-01T00:00:00.000Z"),
      makeHoldingRow("h2", "VWO", 200, "2025-01-01T00:00:00.000Z"),
    ];
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(2));

    await act(async () => {
      await result.current.refreshSignals();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/portfolio/p1/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    expect(result.current.lastRefreshed).toBe("2025-01-01T00:00:00.000Z");
    expect(result.current.loading).toBe(false);
  });

  test("refreshSignals sets error on 500", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/workbook/holdings?portfolioId=") && method === "GET") {
        return new Response(JSON.stringify({ holdings: holdingsData }), { status: 200 });
      }
      if (url.startsWith("/api/portfolio/p1/refresh") && method === "POST") {
        return new Response(JSON.stringify({ error: "DB connection lost" }), { status: 500 });
      }
      return new Response(JSON.stringify({ error: "Unhandled route" }), { status: 500 });
    });

    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(3));

    await act(async () => {
      await result.current.refreshSignals();
    });

    expect(result.current.error).toContain("DB connection lost");
    expect(result.current.loading).toBe(false);
  });

  test("removeHolding removes row from local state immediately", async () => {
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(3));
    const beforeTotal = result.current.totalMV;

    await act(async () => {
      await result.current.removeHolding("h2");
    });

    expect(result.current.computed.map((r) => r.id)).toEqual(["h1", "h3"]);
    expect(result.current.totalMV).toBe(400);
    expect(result.current.totalMV).toBeLessThan(beforeTotal);
  });

  test("addHolding with duplicate symbol is rejected by backend response", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.startsWith("/api/workbook/holdings?portfolioId=") && method === "GET") {
        return new Response(JSON.stringify({ holdings: holdingsData }), { status: 200 });
      }
      if (url === "/api/workbook/holdings" && method === "POST") {
        return new Response(JSON.stringify({ error: "Duplicate symbol VEA" }), { status: 409 });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(3));

    await expect(
      act(async () => {
        await result.current.addHolding({ symbol: "VEA", quantity: 100 });
      }),
    ).rejects.toThrow("Duplicate symbol VEA");

    expect(result.current.computed.filter((r) => r.symbol === "VEA")).toHaveLength(1);
  });

  test("realtimeStatus initialises as 'connecting'", () => {
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    expect(result.current.realtimeStatus).toBe("connecting");
  });

  test("realtimeStatus becomes 'connected' on SUBSCRIBED", async () => {
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());
    await act(async () => {
      lastSubscribeCb?.("SUBSCRIBED");
    });
    expect(result.current.realtimeStatus).toBe("connected");
  });

  test("realtimeStatus becomes 'disconnected' on CHANNEL_ERROR", async () => {
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());
    await act(async () => {
      lastSubscribeCb?.("CHANNEL_ERROR");
    });
    expect(result.current.realtimeStatus).toBe("disconnected");
  });

  test("UPDATE event merges into computed state", async () => {
    holdingsData = [makeHoldingRow("h1", "VEA", 100), makeHoldingRow("h2", "VWO", 200)];
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(2));
    await waitFor(() => expect(lastRealtimeHandler).toBeDefined());
    const beforeH2 = result.current.computed.find((r) => r.id === "h2");
    await act(async () => {
      lastRealtimeHandler?.({
        eventType: "UPDATE",
        new: { id: "h1", rank_overall: 1, alert_primary: "Consider Entry" },
      });
    });
    const h1 = result.current.computed.find((r) => r.id === "h1");
    expect(h1?.rank_overall).toBe(1);
    expect(h1?.alert_primary).toBe("Consider Entry");
    expect(result.current.computed.find((r) => r.id === "h2")).toEqual(beforeH2);
    expect(result.current.totalMV).toBe(300);
  });

  test("DELETE event removes row from computed state", async () => {
    holdingsData = [makeHoldingRow("h1", "VEA", 100), makeHoldingRow("h2", "VWO", 200)];
    const { result } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(2));
    await waitFor(() => expect(lastRealtimeHandler).toBeDefined());
    await act(async () => {
      lastRealtimeHandler?.({ eventType: "DELETE", old: { id: "h1" } });
    });
    expect(result.current.computed).toHaveLength(1);
    expect(result.current.computed[0]?.id).toBe("h2");
  });

  test("channel is removed on unmount", async () => {
    const { result, unmount } = renderHook(() => usePortfolioEngine("p1"));
    await waitFor(() => expect(result.current.computed).toHaveLength(3));
    await waitFor(() => expect(channelMock.subscribe).toHaveBeenCalled());
    unmount();
    expect(removeChannelMock).toHaveBeenCalledTimes(1);
  });
});
