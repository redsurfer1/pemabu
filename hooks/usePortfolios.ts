"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Holding, Portfolio, PortfolioSummary, Signal } from "@/lib/types/database";

// ── Query keys ──────────────────────────────────────

export const portfolioKeys = {
  all: ["portfolios"] as const,
  lists: () => [...portfolioKeys.all, "list"] as const,
  detail: (id: string) => [...portfolioKeys.all, "detail", id] as const,
  holdings: (id: string) => [...portfolioKeys.all, id, "holdings"] as const,
  signals: (id: string, filters: Record<string, string>) =>
    [...portfolioKeys.all, id, "signals", filters] as const,
  consolidated: (userId: string) => ["consolidated", userId] as const,
};

export function toSignalFiltersRecord(filters?: {
  type?: string;
  status?: string;
  limit?: number;
}): Record<string, string> {
  const r: Record<string, string> = {};
  if (filters?.type) r.type = filters.type;
  if (filters?.status) r.status = filters.status;
  if (filters?.limit != null) r.limit = String(filters.limit);
  return r;
}

// ── Fetchers ────────────────────────────────────────

async function fetchPortfolios(): Promise<Portfolio[]> {
  const res = await fetch("/api/workbook/portfolios", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch portfolios");
  const data = (await res.json()) as { portfolios: Portfolio[] };
  return data.portfolios;
}

export async function fetchHoldings(portfolioId: string): Promise<Holding[]> {
  const res = await fetch(`/api/workbook/holdings?portfolioId=${encodeURIComponent(portfolioId)}`, {
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to fetch holdings");
  const data = (await res.json()) as { holdings: Holding[] };
  return data.holdings;
}

export async function fetchSignals(
  portfolioId: string,
  filters?: { type?: string; status?: string; limit?: number },
): Promise<Signal[]> {
  const params = new URLSearchParams({ portfolioId });
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.limit != null) params.set("limit", String(filters.limit));
  const res = await fetch(`/api/workbook/signal-history?${params}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch signals");
  const data = (await res.json()) as { signals: Signal[] };
  return data.signals;
}

async function fetchConsolidated(): Promise<{
  portfolios: PortfolioSummary[];
  totalEquity: number;
  asOf: string;
}> {
  const controller = new AbortController();
  const clientTimeoutMs = 30_000;
  const timeoutId = setTimeout(() => controller.abort(), clientTimeoutMs);
  try {
    const res = await fetch("/api/workbook/consolidated", {
      credentials: "same-origin",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`consolidated ${res.status}: ${JSON.stringify(body)}`);
    }
    return res.json() as Promise<{
      portfolios: PortfolioSummary[];
      totalEquity: number;
      asOf: string;
    }>;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`consolidated timed out after ${clientTimeoutMs / 1000}s (no response)`);
    }
    throw e;
  }
}

// ── Hooks ────────────────────────────────────────────

export function usePortfolios() {
  return useQuery({
    queryKey: portfolioKeys.lists(),
    queryFn: fetchPortfolios,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePortfolioHoldings(portfolioId: string) {
  return useQuery({
    queryKey: portfolioKeys.holdings(portfolioId),
    queryFn: () => fetchHoldings(portfolioId),
    enabled: !!portfolioId,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePortfolioSignals(
  portfolioId: string,
  filters?: { type?: string; status?: string; limit?: number },
) {
  const filterKey = useMemo(
    () => toSignalFiltersRecord(filters),
    [filters?.limit, filters?.status, filters?.type],
  );
  return useQuery({
    queryKey: portfolioKeys.signals(portfolioId, filterKey),
    queryFn: () => fetchSignals(portfolioId, filters),
    enabled: !!portfolioId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useConsolidatedDashboard(userId: string) {
  return useQuery({
    queryKey: portfolioKeys.consolidated(userId),
    queryFn: fetchConsolidated,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ── Mutations ────────────────────────────────────────

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; currency?: string }) => {
      const res = await fetch("/api/workbook/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create portfolio");
      return res.json() as Promise<{ portfolio: Portfolio }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.lists() });
      qc.invalidateQueries({ queryKey: ["consolidated"] });
    },
  });
}

export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (portfolioId: string) => {
      const res = await fetch(`/api/workbook/portfolios/${portfolioId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed to delete portfolio");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.all });
      qc.invalidateQueries({ queryKey: ["consolidated"] });
    },
  });
}

export function useUpdateHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      holdingId: string;
      portfolioId: string;
      data: {
        name?: string | null;
        asset_class?: string;
        quantity?: number;
        cost_basis?: number | null;
        currency?: string;
        expense_ratio?: number | null;
        target_weight_pct?: number | null;
      };
    }) => {
      const res = await fetch(`/api/workbook/holdings/${input.holdingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input.data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Update failed: ${res.status} — ${JSON.stringify(err)}`);
      }
      return res.json() as Promise<{ holding: Holding }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.holdings(variables.portfolioId) });
      qc.invalidateQueries({ queryKey: portfolioKeys.lists() });
      qc.invalidateQueries({ queryKey: ["consolidated"] });
    },
  });
}

export function useDeleteHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { holdingId: string; portfolioId: string }) => {
      const res = await fetch(`/api/workbook/holdings/${input.holdingId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Delete failed: ${res.status} — ${JSON.stringify(err)}`);
      }
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.holdings(variables.portfolioId) });
      qc.invalidateQueries({ queryKey: portfolioKeys.lists() });
      qc.invalidateQueries({ queryKey: ["consolidated"] });
    },
  });
}

export function useUpsertHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      portfolio_id: string;
      ticker: string;
      name?: string;
      asset_class: string;
      quantity: number;
      cost_basis?: number;
      currency?: string;
      source?: string;
      expense_ratio?: number;
      target_weight_pct?: number;
    }) => {
      const res = await fetch("/api/workbook/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`Failed to save holding: ${res.status} — ${JSON.stringify(errBody)}`);
      }
      return res.json() as Promise<{ holding: Holding }>;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.holdings(variables.portfolio_id) });
      qc.invalidateQueries({ queryKey: portfolioKeys.lists() });
      qc.invalidateQueries({ queryKey: ["consolidated"] });
    },
  });
}

export function useAcknowledgeSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { signalId: string; action: "acknowledge" | "resolve" }) => {
      const res = await fetch("/api/workbook/signal-history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          signalId: input.signalId,
          action: input.action,
        }),
      });
      if (!res.ok) throw new Error("Failed to update signal");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.all });
      qc.invalidateQueries({ queryKey: ["consolidated"] });
    },
  });
}
