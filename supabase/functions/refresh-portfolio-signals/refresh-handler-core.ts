const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Minimal Supabase shape used by this handler (Deno + Vitest friendly). */
export type PortfolioRefreshSupabase = {
  from: (table: string) => {
    select: (cols: string) => Promise<{
      data: Array<{ id: string }> | null;
      error: { message: string } | null;
    }>;
  };
};

export type RefreshHandlerDeps = {
  getEnv: (key: string) => string | undefined;
  fetchImpl: typeof fetch;
  createSupabase: (url: string, key: string) => PortfolioRefreshSupabase;
};

export function createRefreshHandler(deps: RefreshHandlerDeps) {
  const { getEnv, fetchImpl, createSupabase } = deps;

  return async function handleRefreshRequest(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const secret = getEnv("PEMABU_CRON_SECRET");
    const headerSecret = req.headers.get("x-pemabu-cron-secret");
    if (!secret || headerSecret !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = getEnv("NEXT_PUBLIC_APP_URL");

    if (!supabaseUrl || !serviceKey || !appUrl) {
      return new Response(JSON.stringify({ error: "Missing environment" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createSupabase(supabaseUrl, serviceKey);

    const { data: portfolios, error: pErr } = await supabase.from("portfolios").select("id");
    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const list = portfolios ?? [];
    const results: Array<{ portfolioId: string; success: boolean; error?: string }> = [];
    let succeeded = 0;
    let failed = 0;

    const base = appUrl.replace(/\/$/, "");

    for (const row of list) {
      const portfolioId = String(row.id);
      try {
        const res = await fetchImpl(`${base}/api/portfolio/${encodeURIComponent(portfolioId)}/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-pemabu-force-refresh": "true",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: "{}",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          const errMsg = body.error ?? `HTTP ${res.status}`;
          failed += 1;
          results.push({ portfolioId, success: false, error: errMsg });
        } else {
          succeeded += 1;
          results.push({ portfolioId, success: true });
        }
      } catch (e) {
        failed += 1;
        results.push({
          portfolioId,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      await sleep(300);
    }

    return new Response(
      JSON.stringify({
        processed: list.length,
        succeeded,
        failed,
        results,
        completedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
}
