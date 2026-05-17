import { beforeEach, describe, expect, test, vi } from "vitest";

const createClientMock = vi.fn();
const refreshPortfolioSignalsMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("@/lib/allocation/refresh-portfolio-signals", () => ({
  refreshPortfolioSignals: (...args: unknown[]) => refreshPortfolioSignalsMock(...args),
}));

// Dynamic imports inside executeRefresh — must be mocked so tests don't
// hit supabaseAdmin (which requires NEXT_PUBLIC_SUPABASE_URL in env).
vi.mock("@/lib/services/user-entitlements", () => ({
  getActiveServiceKeysForUser: () => Promise.resolve(["intelligence_annual"]),
}));

vi.mock("@/lib/entitlements/tier-capabilities", () => ({
  canUseExchangePriceSync: () => true,
}));

vi.mock("@/lib/security/tier-guard", () => ({
  tierForbiddenResponse: () =>
    new Response(JSON.stringify({ error: "tier forbidden" }), { status: 403 }),
}));

// Sovereign score pipeline — fire-and-forget; no-op in tests so we don't
// need CoinGecko / supabaseAdmin reachable.
vi.mock("@/lib/portfolio/sovereign-score-pipeline", () => ({
  runSovereignScorePipeline: () => Promise.resolve(),
}));

import { POST } from "./[portfolioId]/refresh/route";

type MockSetup = {
  userId: string | null;
  portfolioOwnerId?: string;
  holdingCount?: number;
  portfolioMissing?: boolean;
};

function setupSupabase({
  userId,
  portfolioOwnerId = "user-A",
  holdingCount = 0,
  portfolioMissing = false,
}: MockSetup) {
  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? ({ id: userId } as { id: string }) : null,
        },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "portfolios") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue(
                portfolioMissing
                  ? { data: null, error: { message: "not found" } }
                  : { data: { id: "p1", user_id: portfolioOwnerId }, error: null },
              ),
            })),
          })),
        };
      }

      if (table === "portfolio_holdings") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ count: holdingCount, error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
  createClientMock.mockResolvedValue(mock);
  return mock;
}

describe("POST /api/portfolio/[portfolioId]/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("unauthenticated request returns 401", async () => {
    setupSupabase({ userId: null });

    const res = await POST(new Request("http://localhost/api/portfolio/p1/refresh", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: "p1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized" });
    expect(refreshPortfolioSignalsMock).not.toHaveBeenCalled();
  });

  test("authenticated but wrong owner returns 403", async () => {
    setupSupabase({ userId: "user-A", portfolioOwnerId: "user-B", holdingCount: 10 });

    const res = await POST(new Request("http://localhost/api/portfolio/p1/refresh", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: "p1" }),
    });

    expect(res.status).toBe(403);
    expect(refreshPortfolioSignalsMock).not.toHaveBeenCalled();
  });

  test("authenticated correct owner, <= 15 holdings, returns 200", async () => {
    setupSupabase({ userId: "user-A", portfolioOwnerId: "user-A", holdingCount: 10 });
    refreshPortfolioSignalsMock.mockResolvedValue(undefined);

    const res = await POST(new Request("http://localhost/api/portfolio/p1/refresh", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: "p1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.refreshedAt).toBe("string");
    expect(Number.isNaN(Date.parse(body.refreshedAt))).toBe(false);
    expect(refreshPortfolioSignalsMock).toHaveBeenCalledTimes(1);
    expect(refreshPortfolioSignalsMock).toHaveBeenCalledWith("p1", expect.any(Object));
  });

  test("authenticated correct owner, > 15 holdings, no override, returns 202", async () => {
    setupSupabase({ userId: "user-A", portfolioOwnerId: "user-A", holdingCount: 20 });

    const res = await POST(new Request("http://localhost/api/portfolio/p1/refresh", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: "p1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body).toMatchObject({ queued: true, holdingCount: 20 });
    expect(refreshPortfolioSignalsMock).not.toHaveBeenCalled();
  });

  test("authenticated correct owner, > 15 holdings, with override, returns 200", async () => {
    setupSupabase({ userId: "user-A", portfolioOwnerId: "user-A", holdingCount: 20 });
    refreshPortfolioSignalsMock.mockResolvedValue(undefined);

    const res = await POST(
      new Request("http://localhost/api/portfolio/p1/refresh", {
        method: "POST",
        headers: { "x-pemabu-force-refresh": "true" },
      }),
      {
        params: Promise.resolve({ portfolioId: "p1" }),
      },
    );

    expect(res.status).toBe(200);
    expect(refreshPortfolioSignalsMock).toHaveBeenCalledTimes(1);
  });

  test("refreshPortfolioSignals throws, returns 500", async () => {
    setupSupabase({ userId: "user-A", portfolioOwnerId: "user-A", holdingCount: 5 });
    refreshPortfolioSignalsMock.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(new Request("http://localhost/api/portfolio/p1/refresh", { method: "POST" }), {
      params: Promise.resolve({ portfolioId: "p1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ error: "DB connection lost" });
  });
});
