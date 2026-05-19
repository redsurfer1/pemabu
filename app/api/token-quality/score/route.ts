import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { READ_RATE_LIMIT } from "@/lib/security/rate-limiter";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scoreTicker } from "@/lib/token-quality/ttf-scorer";

// GET /api/token-quality/score?ticker=ETH[&refresh=1]
// Returns cached TTF score or computes fresh if not cached or refresh requested.
export const GET = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, "addon_token_quality");

  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker")?.toUpperCase().trim();
  const forceRefresh = url.searchParams.get("refresh") === "1";

  if (!ticker) {
    return NextResponse.json({ error: "ticker query parameter required" }, { status: 400 });
  }

  // Check cache (rows are refreshed weekly by the watcher job).
  if (!forceRefresh) {
    const { data: cached } = await supabaseAdmin
      .from("token_ttf_scores")
      .select("*")
      .eq("ticker", ticker)
      .maybeSingle();

    if (cached) {
      return NextResponse.json({ score: cached, cached: true });
    }
  }

  // Score live from CoinGecko.
  try {
    const result = await scoreTicker(ticker);

    // Upsert into cache.
    const { error } = await supabaseAdmin.from("token_ttf_scores").upsert(
      {
        ticker: result.ticker,
        composite_score: result.composite_score,
        criteria: result.criteria,
        summary_flags: result.summary_flags,
        sources: result.sources,
        scored_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ticker" },
    );

    if (error) {
      console.error("token_ttf_scores upsert:", error.message);
    }

    return NextResponse.json({ score: result, cached: false });
  } catch (e) {
    console.error("TTF score error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scoring failed" },
      { status: 502 },
    );
  }
}, { keyTemplate: "token-quality:{userId}", ...READ_RATE_LIMIT });
