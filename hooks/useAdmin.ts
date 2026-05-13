"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isSubscriptionRowAccessActive } from "@/lib/constants/services";
import type { Portfolio, PemabuService, UserSubscription, UserGroupAssignment, SubscriptionGroup, SubscriptionStatus } from "@/lib/types/database";

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

// ─────────────────────────────────────────────────
// Pricing & Subscription hooks
// ─────────────────────────────────────────────────

async function fetchServices(): Promise<PemabuService[]> {
  const res = await fetch("/api/admin/pricing", { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Admin pricing ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = (await res.json()) as { services: PemabuService[] };
  return data.services;
}

async function patchService(payload: {
  service_key: string;
  display_name?: string;
  description?: string | null;
  price_usd?: number;
  is_active?: boolean;
  sort_order?: number;
}): Promise<PemabuService> {
  const res = await fetch("/api/admin/pricing", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Patch service ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = (await res.json()) as { service: PemabuService };
  return data.service;
}

async function fetchSubscriptions(): Promise<UserSubscription[]> {
  const res = await fetch("/api/admin/subscriptions", { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Admin subscriptions ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = (await res.json()) as { subscriptions: UserSubscription[] };
  return data.subscriptions;
}

async function grantSubscription(payload: {
  user_id: string;
  service_key: string;
  status?: SubscriptionStatus;
  price_paid_usd?: number | null;
  notes?: string | null;
  ends_at?: string | null;
}): Promise<UserSubscription> {
  const res = await fetch("/api/admin/subscriptions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Grant subscription ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = (await res.json()) as { subscription: UserSubscription };
  return data.subscription;
}

async function fetchGroupAssignments(): Promise<UserGroupAssignment[]> {
  const res = await fetch("/api/admin/groups", { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Admin groups ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = (await res.json()) as { assignments: UserGroupAssignment[] };
  return data.assignments;
}

async function assignGroup(payload: {
  user_id: string;
  subscription_group: SubscriptionGroup;
  notes?: string | null;
}): Promise<UserGroupAssignment> {
  const res = await fetch("/api/admin/groups", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Assign group ${res.status}: ${JSON.stringify(body)}`);
  }
  const data = (await res.json()) as { assignment: UserGroupAssignment };
  return data.assignment;
}

export function useAdminPricing() {
  const qc = useQueryClient();

  const services = useQuery({
    queryKey: ["admin", "pricing"],
    queryFn: fetchServices,
    staleTime: 60 * 1000,
  });

  const updateService = useMutation({
    mutationFn: patchService,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "pricing"] }),
  });

  const subscriptions = useQuery({
    queryKey: ["admin", "subscriptions"],
    queryFn: fetchSubscriptions,
    staleTime: 30 * 1000,
  });

  const grantSub = useMutation({
    mutationFn: grantSubscription,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] }),
  });

  const groupAssignments = useQuery({
    queryKey: ["admin", "groups"],
    queryFn: fetchGroupAssignments,
    staleTime: 30 * 1000,
  });

  const assignUserGroup = useMutation({
    mutationFn: assignGroup,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "groups"] });
      void qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["admin", "pricing"] });
    },
  });

  return {
    services,
    updateService,
    subscriptions,
    grantSub,
    groupAssignments,
    assignUserGroup,
  };
}

/** Active subscription row: paying, beta complimentary, or (future) explicit trial row. */
export function hasServiceAccess(status: SubscriptionStatus | string): boolean {
  return isSubscriptionRowAccessActive(status);
}
