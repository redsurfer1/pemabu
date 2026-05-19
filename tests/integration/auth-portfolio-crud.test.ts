import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockCreateClient,
  mockGetUserPortfolios,
  mockGetPortfolio,
  mockCreatePortfolio,
  mockUpdatePortfolio,
  mockDeletePortfolio,
  mockGetActiveServiceKeys,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetUserPortfolios: vi.fn(),
  mockGetPortfolio: vi.fn(),
  mockCreatePortfolio: vi.fn(),
  mockUpdatePortfolio: vi.fn(),
  mockDeletePortfolio: vi.fn(),
  mockGetActiveServiceKeys: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    retryAfterSeconds: 0,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/services/portfolio", () => ({
  getUserPortfolios: (...args: unknown[]) => mockGetUserPortfolios(...args),
  getPortfolio: (...args: unknown[]) => mockGetPortfolio(...args),
  createPortfolio: (...args: unknown[]) => mockCreatePortfolio(...args),
  updatePortfolio: (...args: unknown[]) => mockUpdatePortfolio(...args),
  deletePortfolio: (...args: unknown[]) => mockDeletePortfolio(...args),
}));

vi.mock("@/lib/services/user-entitlements", () => ({
  getActiveServiceKeysForUser: (...args: unknown[]) =>
    mockGetActiveServiceKeys(...args),
}));

vi.mock("@/lib/security/tier-guard", () => ({
  resolveEffectiveTier: () => "CORE",
  tierForbiddenResponse: () =>
    new Response(
      JSON.stringify({ error: "Forbidden", code: "TIER_REQUIRED" }),
      { status: 403 },
    ),
}));

vi.mock("@/lib/entitlements/tier-capabilities", () => ({
  maxPortfoliosForTier: () => 10,
}));

vi.mock("@/lib/security/rate-limiter", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  READ_RATE_LIMIT: { maxCount: 60, windowSeconds: 60 },
  MUTATION_RATE_LIMIT: { maxCount: 30, windowSeconds: 60 },
}));

vi.mock("server-only", () => ({}));

import { GET as ListGet, POST as ListPost } from "@/app/api/workbook/portfolios/route";
import { GET as DetailGet, PATCH, DELETE } from "@/app/api/workbook/portfolios/[id]/route";

function mockAuthUser(userId: string | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId
            ? { id: userId, email: `${userId}@test.com` }
            : null,
        },
        error: null,
      }),
    },
  });
}

describe("Auth / Portfolio CRUD flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser("user-1");
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  test("withAuth returns 401 when no user is authenticated", async () => {
    mockAuthUser(null);

    const res = await ListGet(
      new Request("http://localhost/api/workbook/portfolios"),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized" });
  });

  test("GET /api/workbook/portfolios returns the user's portfolios", async () => {
    const portfolios = [
      { id: "p1", name: "Retirement", user_id: "user-1" },
      { id: "p2", name: "Taxable", user_id: "user-1" },
    ];
    mockGetUserPortfolios.mockResolvedValue(portfolios);

    const res = await ListGet(
      new Request("http://localhost/api/workbook/portfolios"),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ portfolios });
    expect(mockGetUserPortfolios).toHaveBeenCalledWith("user-1");
  });

  test("POST /api/workbook/portfolios creates a new portfolio", async () => {
    mockGetUserPortfolios.mockResolvedValue([]);
    mockGetActiveServiceKeys.mockResolvedValue(["core_v1"]);
    const created = {
      id: "p3",
      name: "New Portfolio",
      user_id: "user-1",
      currency: "USD",
    };
    mockCreatePortfolio.mockResolvedValue(created);

    const res = await ListPost(
      new Request("http://localhost/api/workbook/portfolios", {
        method: "POST",
        body: JSON.stringify({ name: "New Portfolio" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ portfolio: created });
    expect(mockCreatePortfolio).toHaveBeenCalledWith("user-1", {
      name: "New Portfolio",
      description: null,
      currency: "USD",
    });
  });

  test("POST enforces tier portfolio limit", async () => {
    mockGetUserPortfolios.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        name: `Portfolio ${i}`,
        user_id: "user-1",
      })),
    );
    mockGetActiveServiceKeys.mockResolvedValue(["core_v1"]);

    const res = await ListPost(
      new Request("http://localhost/api/workbook/portfolios", {
        method: "POST",
        body: JSON.stringify({ name: "Too Many" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(403);
    expect(mockCreatePortfolio).not.toHaveBeenCalled();
  });

  test("PATCH /api/workbook/portfolios/[id] updates the portfolio", async () => {
    mockGetPortfolio.mockResolvedValue({
      id: "p1",
      name: "Old Name",
      user_id: "user-1",
    });
    mockUpdatePortfolio.mockResolvedValue({
      id: "p1",
      name: "Updated Name",
      user_id: "user-1",
    });

    const res = await PATCH(
      new Request("http://localhost/api/workbook/portfolios/p1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Name" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.portfolio.name).toBe("Updated Name");
    expect(mockUpdatePortfolio).toHaveBeenCalledWith("p1", {
      name: "Updated Name",
    });
  });

  test("DELETE /api/workbook/portfolios/[id] deletes it", async () => {
    mockGetPortfolio.mockResolvedValue({
      id: "p1",
      name: "To Delete",
      user_id: "user-1",
    });
    mockDeletePortfolio.mockResolvedValue(undefined);

    const res = await DELETE(
      new Request("http://localhost/api/workbook/portfolios/p1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockDeletePortfolio).toHaveBeenCalledWith("p1");
  });

  test("unauthorized users cannot access other users' portfolios", async () => {
    mockAuthUser("user-2");
    mockGetPortfolio.mockResolvedValue({
      id: "p1",
      name: "Secret",
      user_id: "user-1",
    });

    const res = await DetailGet(
      new Request("http://localhost/api/workbook/portfolios/p1"),
      { params: Promise.resolve({ id: "p1" }) },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });
});
