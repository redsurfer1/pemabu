"use client";

import { useQuery } from "@tanstack/react-query";
import type { Portfolio } from "@/lib/types/database";

export interface AdminUser {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in: string | null;
  profile: {
    role: string;
    display_name: string | null;
  } | null;
}

export type AdminPortfolio = Portfolio & {
  holdings_count: number;
  open_signals: number;
};

export interface AdminStats {
  users: number;
  portfolios: number;
  unacknowledged_signals: number;
  market_data_health: {
    ok: boolean;
    provider: string;
    latencyMs: number;
    message?: string;
  };
  as_of: string;
}

async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await fetch("/api/admin/users", { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Admin users ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = (await res.json()) as { users: AdminUser[] };
  return data.users;
}

async function fetchAdminPortfolios(): Promise<AdminPortfolio[]> {
  const res = await fetch("/api/admin/portfolios", { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Admin portfolios ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = (await res.json()) as { portfolios: AdminPortfolio[] };
  return data.portfolios;
}

async function fetchAdminStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats", { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Admin stats ${res.status}: ${JSON.stringify(body)}`);
  }
  return res.json() as Promise<AdminStats>;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchAdminUsers,
    staleTime: 60 * 1000,
  });
}

export function useAdminPortfolios() {
  return useQuery({
    queryKey: ["admin", "portfolios"],
    queryFn: fetchAdminPortfolios,
    staleTime: 60 * 1000,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: fetchAdminStats,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
