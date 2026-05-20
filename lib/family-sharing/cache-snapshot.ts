import { toRecord } from "@/lib/supabase/typed";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  calculateAllocationWeights,
  calculatePortfolioValue,
  detectDrift,
  DEFAULT_TARGETS,
  DRIFT_THRESHOLD_PCT,
  type Quote,
} from "@/lib/allocation/asset-class-utils";
import type { Holding } from "@/lib/types/database";

export interface FamilySnapshotData {
  totalValue: number | null;
  driftStatus: "ok" | "drifted" | "unknown";
  allocations: { assetClass: string; pct: number }[];
  sectorWeights: { sector: string; pct: number }[];
  lastUpdated: string | null;
}

async function computeFamilySnapshot(
  userId: string,
  portfolioId?: string | null,
): Promise<FamilySnapshotData | null> {
  let portfolioIds: string[];

  if (portfolioId) {
    const { data: p } = await supabaseAdmin
      .from("portfolios")
      .select("id")
      .eq("id", portfolioId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!p) return null;
    portfolioIds = [portfolioId];
  } else {
    const { data: portfolios } = await supabaseAdmin
      .from("portfolios")
      .select("id")
      .eq("user_id", userId);
    portfolioIds = ((portfolios ?? []) as { id: string }[]).map((p) => p.id);
  }

  if (portfolioIds.length === 0) return null;

  const { data: holdings, error: hErr } = await supabaseAdmin
    .from("portfolio_holdings")
    .select("*")
    .in("portfolio_id", portfolioIds);

  if (hErr || !holdings || holdings.length === 0) {
    if (hErr) console.error("computeFamilySnapshot error:", hErr.message);
    return null;
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

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    driftStatus: drifts.length > 0 ? "drifted" : "ok",
    allocations: weights.map((w) => ({
      assetClass: w.asset_class,
      pct: Math.round(w.actual_pct * 100) / 100,
    })),
    sectorWeights: [],
    lastUpdated,
  };
}

export async function cacheFamilyPortfolioSnapshot(
  userId: string,
): Promise<{ cached: number; skipped: number }> {
  const snapshot = await computeFamilySnapshot(userId);

  if (!snapshot) {
    return { cached: 0, skipped: 0 };
  }

  const { data: tokens, error: tokenErr } = await supabaseAdmin
    .from("family_share_tokens")
    .select("id, portfolio_id")
    .eq("owner_user_id", userId)
    .eq("is_active", true);

  if (tokenErr) {
    console.error("cacheFamilyPortfolioSnapshot token lookup:", tokenErr.message);
    return { cached: 0, skipped: 0 };
  }

  if (!tokens || tokens.length === 0) {
    return { cached: 0, skipped: 0 };
  }

  const now = new Date().toISOString();
  let cached = 0;
  let skipped = 0;

  for (const token of tokens) {
    const tokenId = (token as { id: string; portfolio_id: string | null }).id;
    const tokenPortfolioId = (token as { id: string; portfolio_id: string | null }).portfolio_id;

    let tokenSnapshot = snapshot;
    if (tokenPortfolioId) {
      const perToken = await computeFamilySnapshot(userId, tokenPortfolioId);
      if (!perToken) {
        skipped++;
        continue;
      }
      tokenSnapshot = perToken;
    }

    const { error: delErr } = await supabaseAdmin
      .from("family_portfolio_snapshots")
      .delete()
      .eq("family_share_token_id", tokenId);

    if (delErr) {
      console.error("cacheFamilyPortfolioSnapshot delete error:", delErr.message);
      skipped++;
      continue;
    }

    const { error: insErr } = await supabaseAdmin
      .from("family_portfolio_snapshots")
      .insert({
        family_share_token_id: tokenId,
        snapshot_data: toRecord(tokenSnapshot),
        computed_at: now,
      });

    if (insErr) {
      console.error("cacheFamilyPortfolioSnapshot insert error:", insErr.message);
      skipped++;
    } else {
      cached++;
    }
  }

  return { cached, skipped };
}
