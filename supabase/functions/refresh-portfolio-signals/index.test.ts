import { describe, expect, test, vi } from "vitest";
import { createRefreshHandler, type PortfolioRefreshSupabase } from "./refresh-handler-core";

function mockSupabase(ids: Array<{ id: string }>): PortfolioRefreshSupabase {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: ids, error: null })),
    })),
  };
}

describe("refresh-portfolio-signals handler", () => {
  const baseEnv: Record<string, string> = {
    PEMABU_CRON_SECRET: "0123456789abcdef0123456789abcd",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
  };

  test("missing secret returns 401", async () => {
    const handler = createRefreshHandler({
      getEnv: (k) => (k === "PEMABU_CRON_SECRET" ? undefined : baseEnv[k]),
      fetchImpl: vi.fn(),
      createSupabase: () => mockSupabase([]),
    });
    const res = await handler(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "x-pemabu-cron-secret": "" },
      }),
    );
    expect(res.status).toBe(401);
  });

  test("wrong secret returns 401", async () => {
    const handler = createRefreshHandler({
      getEnv: (k) => baseEnv[k],
      fetchImpl: vi.fn(),
      createSupabase: () => mockSupabase([]),
    });
    const res = await handler(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "x-pemabu-cron-secret": "wrong-value" },
      }),
    );
    expect(res.status).toBe(401);
  });

  test("non-POST method returns 405", async () => {
    const handler = createRefreshHandler({
      getEnv: (k) => baseEnv[k],
      fetchImpl: vi.fn(),
      createSupabase: () => mockSupabase([]),
    });
    const res = await handler(
      new Request("http://localhost/", {
        method: "GET",
        headers: { "x-pemabu-cron-secret": baseEnv.PEMABU_CRON_SECRET },
      }),
    );
    expect(res.status).toBe(405);
  });

  test("happy path: all portfolios succeed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const handler = createRefreshHandler({
      getEnv: (k) => baseEnv[k],
      fetchImpl,
      createSupabase: () => mockSupabase([{ id: "a" }, { id: "b" }, { id: "c" }]),
    });
    const res = await handler(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "x-pemabu-cron-secret": baseEnv.PEMABU_CRON_SECRET },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(body.succeeded).toBe(3);
    expect(body.failed).toBe(0);
 });

  test("partial failure: one portfolio refresh fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "boom" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    const handler = createRefreshHandler({
      getEnv: (k) => baseEnv[k],
      fetchImpl,
      createSupabase: () => mockSupabase([{ id: "a" }, { id: "b" }, { id: "c" }]),
    });
    const res = await handler(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "x-pemabu-cron-secret": baseEnv.PEMABU_CRON_SECRET },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.results.some((r: { success: boolean }) => r.success === false)).toBe(true);
  });

  test("empty portfolio list succeeds with zero counts", async () => {
    const fetchImpl = vi.fn();
    const handler = createRefreshHandler({
      getEnv: (k) => baseEnv[k],
      fetchImpl,
      createSupabase: () => mockSupabase([]),
    });
    const res = await handler(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "x-pemabu-cron-secret": baseEnv.PEMABU_CRON_SECRET },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(body.succeeded).toBe(0);
    expect(body.failed).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
