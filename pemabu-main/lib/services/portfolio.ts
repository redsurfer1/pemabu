// lib/services/portfolio.ts
// Server-side portfolio data access.
// Import only in API route handlers and server
// components — never in 'use client' files.

import { createClient } from "@/lib/supabase/server";
import type {
  Portfolio,
  Holding,
  AllocationSnapshot,
  Signal,
  PortfolioSummary,
} from "@/lib/types/database";
import {
  calculatePortfolioValue,
  calculateAllocationWeights,
  DEFAULT_TARGETS,
  type Quote,
} from "@/lib/allocation/engine";

// ── Portfolios ──────────────────────────────────────

export async function getUserPortfolios(userId: string): Promise<Portfolio[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Portfolio[];
}

export async function getPortfolio(portfolioId: string): Promise<Portfolio | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("portfolios").select("*").eq("id", portfolioId).single();

  if (error) return null;
  return data as Portfolio;
}

export async function createPortfolio(
  userId: string,
  input: Pick<Portfolio, "name" | "description" | "currency">,
): Promise<Portfolio> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .insert({ ...input, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data as Portfolio;
}

export async function updatePortfolio(
  portfolioId: string,
  input: Partial<Pick<Portfolio, "name" | "description" | "currency">>,
): Promise<Portfolio> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", portfolioId)
    .select()
    .single();

  if (error) throw error;
  return data as Portfolio;
}

export async function deletePortfolio(portfolioId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("portfolios").delete().eq("id", portfolioId);

  if (error) throw error;
}

// ── Holdings ────────────────────────────────────────

export async function getPortfolioHoldings(portfolioId: string): Promise<Holding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("ticker", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Holding[];
}

export type UpsertHoldingInput = Pick<
  Holding,
  "ticker" | "name" | "asset_class" | "quantity" | "cost_basis" | "currency" | "source"
> &
  Partial<Pick<Holding, "expense_ratio" | "target_weight_pct">>;

export async function upsertHolding(portfolioId: string, input: UpsertHoldingInput): Promise<Holding> {
  const supabase = await createClient();
  const enrichedInput = { ...input };
  if (input.asset_class === "cash") {
    enrichedInput.ticker = "CASH";
  }

  const { data, error } = await supabase
    .from("portfolio_holdings")
    .upsert({ ...enrichedInput, portfolio_id: portfolioId }, { onConflict: "portfolio_id,ticker" })
    .select()
    .single();

  if (error) throw error;

  if (input.asset_class === "cash") {
    await supabase
      .from("portfolio_holdings")
      .update({
        current_price: 1.00,
        last_price_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", (data as Holding).id);
  }

  return data as Holding;
}

export async function deleteHolding(holdingId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("portfolio_holdings").delete().eq("id", holdingId);

  if (error) throw error;
}

// ── Signals ─────────────────────────────────────────

export async function getPortfolioSignals(
  portfolioId: string,
  options?: {
    type?: string;
    status?: string;
    limit?: number;
  },
): Promise<Signal[]> {
  const supabase = await createClient();
  let query = supabase
    .from("signals")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: false });

  if (options?.type) {
    query = query.eq("type", options.type);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Signal[];
}

export async function acknowledgeSignal(signalId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("signals")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", signalId);

  if (error) throw error;
}

export async function resolveSignal(signalId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("signals")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", signalId);

  if (error) throw error;
}

// ── Snapshots ───────────────────────────────────────

export async function getLatestSnapshot(portfolioId: string): Promise<AllocationSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allocation_snapshots")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as AllocationSnapshot;
}

// ── Consolidated dashboard data ──────────────────────

export async function getConsolidatedDashboard(
  userId: string,
  quotesMap: Map<string, Quote>,
): Promise<{
  portfolios: PortfolioSummary[];
  totalEquity: number;
  asOf: string;
}> {
  const portfolios = await getUserPortfolios(userId);

  const summaries = await Promise.all(
    portfolios.map(async (portfolio) => {
      const holdings = await getPortfolioHoldings(portfolio.id);
      const topSignal = await getPortfolioSignals(portfolio.id, {
        status: "unacknowledged",
        limit: 1,
      }).then((s) => s[0] ?? null);
      const lastSnapshot = await getLatestSnapshot(portfolio.id);

      const weights = calculateAllocationWeights(holdings, quotesMap, DEFAULT_TARGETS);
      const totalValue = calculatePortfolioValue(holdings, quotesMap);

      return {
        portfolio,
        total_value: Math.round(totalValue * 100) / 100,
        holdings_count: holdings.length,
        top_signal: topSignal,
        allocation: weights,
        last_snapshot_at: lastSnapshot?.created_at ?? null,
      } satisfies PortfolioSummary;
    }),
  );

  const totalEquity = summaries.reduce((sum, s) => sum + s.total_value, 0);

  return {
    portfolios: summaries,
    totalEquity: Math.round(totalEquity * 100) / 100,
    asOf: new Date().toISOString(),
  };
}
