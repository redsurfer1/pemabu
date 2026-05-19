import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hashShareToken } from "@/lib/family-sharing/token-service";
import {
  calculateAllocationWeights,
  calculatePortfolioValue,
  detectDrift,
  DEFAULT_TARGETS,
  DRIFT_THRESHOLD_PCT,
  type Quote,
} from "@/lib/allocation/engine";
import type { Holding } from "@/lib/types/database";

const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: "Equities",
  fixed_income: "Fixed Income",
  alternatives: "Alternatives",
  cash: "Cash",
  crypto: "Crypto",
  other: "Other",
};

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token || !token.startsWith("pemabu_share_")) {
    return NextResponse.json({ error: "Invalid token format." }, { status: 401 });
  }

  const tokenHash = hashShareToken(token);

  const { data: matchedToken, error } = await supabaseAdmin
    .from("family_share_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("family view lookup:", error.message);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  if (!matchedToken) {
    return NextResponse.json({ error: "Token not found or revoked." }, { status: 401 });
  }

  const { error: logErr } = await supabaseAdmin.from("family_share_access_log").insert({ token_id: matchedToken.id });
  if (logErr) console.error("family_share_access_log:", logErr.message);

  const { error: upErr } = await supabaseAdmin
    .from("family_share_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", matchedToken.id);
  if (upErr) console.error("family_share_tokens touch:", upErr.message);

  const scope = {
    owner_user_id: matchedToken.owner_user_id,
    viewer_label: matchedToken.viewer_label,
    show_total_value: matchedToken.show_total_value,
    show_drift_status: matchedToken.show_drift_status,
    show_allocation_pct: matchedToken.show_allocation_pct,
    show_sector_weights: matchedToken.show_sector_weights,
  };

  const portfolio = await fetchFamilyPortfolioData(
    matchedToken.owner_user_id,
    matchedToken.portfolio_id as string | null | undefined,
  );

  return NextResponse.json({ scope, portfolio });
}

async function fetchFamilyPortfolioData(
  ownerUserId: string,
  portfolioId?: string | null,
): Promise<{
  totalValue: number | null;
  driftStatus: "ok" | "drifted" | "unknown";
  allocations: { assetClass: string; pct: number }[];
  sectorWeights: { sector: string; pct: number }[];
  lastUpdated: string | null;
}> {
  let portfolioIds: string[];
  if (portfolioId) {
    const { data: p } = await supabaseAdmin
      .from("portfolios")
      .select("id")
      .eq("id", portfolioId)
      .eq("user_id", ownerUserId)
      .maybeSingle();
    if (!p) return { totalValue: null, driftStatus: "unknown", allocations: [], sectorWeights: [], lastUpdated: null };
    portfolioIds = [portfolioId];
  } else {
    const { data: portfolios } = await supabaseAdmin
      .from("portfolios")
      .select("id")
      .eq("user_id", ownerUserId);
    portfolioIds = ((portfolios ?? []) as { id: string }[]).map((p) => p.id);
  }

  if (portfolioIds.length === 0) {
    return { totalValue: null, driftStatus: "unknown", allocations: [], sectorWeights: [], lastUpdated: null };
  }

  const { data: holdings, error: hErr } = await supabaseAdmin
    .from("portfolio_holdings")
    .select("*")
    .in("portfolio_id", portfolioIds);

  if (hErr || !holdings || holdings.length === 0) {
    if (hErr) console.error("fetchFamilyPortfolioData holdings error:", hErr.message);
    return { totalValue: null, driftStatus: "unknown", allocations: [], sectorWeights: [], lastUpdated: null };
  }

  const typedHoldings = holdings as Holding[];

  const quotesMap = new Map<string, Quote>();
  let lastUpdated: string | null = null;

  for (const h of typedHoldings) {
    if (h.last_price_refreshed_at && (!lastUpdated || h.last_price_refreshed_at > lastUpdated)) {
      lastUpdated = h.last_price_refreshed_at;
    }
    if (h.asset_class === "cash") {
      quotesMap.set(h.ticker, {
        ticker: h.ticker,
        price: 1,
        currency: h.currency,
        asOf: new Date(),
        source: "fixed",
      });
    } else {
      quotesMap.set(h.ticker, {
        ticker: h.ticker,
        price: Number(h.current_price ?? 0),
        currency: h.currency,
        asOf: new Date(),
        source: "snapshot",
      });
    }
  }

  const totalValue = calculatePortfolioValue(typedHoldings, quotesMap);
  const weights = calculateAllocationWeights(typedHoldings, quotesMap, DEFAULT_TARGETS);
  const drifts = detectDrift(weights, DRIFT_THRESHOLD_PCT);

  const allocations = weights.map((w) => ({
    assetClass: w.asset_class,
    pct: Math.round(w.actual_pct * 100) / 100,
  }));

  const sectorWeights = weights.map((w) => ({
    sector: ASSET_CLASS_LABELS[w.asset_class] ?? w.asset_class,
    pct: Math.round(w.actual_pct * 100) / 100,
  }));

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    driftStatus: drifts.length > 0 ? "drifted" : "ok",
    allocations,
    sectorWeights,
    lastUpdated,
  };
}
