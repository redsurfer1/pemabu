"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";
import { ShareCreatorProfileButton } from "@/components/marketplace/ShareCreatorProfileButton";

interface Payout {
  id: string;
  amount_cents: number;
  status: string;
  requested_at: string;
  paid_at: string | null;
}

interface DashboardStats {
  totalStrategies: number;
  totalImports: number;
  totalRoyaltiesCents: number;
  availableForPayoutCents: number;
  pendingPayoutCents: number;
  recentPayouts: Payout[];
  foundingPublisherSlot: number | null;
}

interface CreatorStrategy {
  id: string;
  displayName: string;
  strategyGrade: string | number;
  isFoundingPublisher: boolean;
  publishedAt: string;
  importCount: number;
  performance: {
    consistency: string;
    avgDriftPct: number | null;
    weeksTracked: number;
  };
}

interface StrategiesResponse {
  creatorPublicId: string;
  strategies: CreatorStrategy[];
}

async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch("/api/creator/dashboard/stats", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return (await res.json()) as DashboardStats;
}

async function fetchStrategies(): Promise<StrategiesResponse> {
  const res = await fetch("/api/creator/dashboard/strategies", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch strategies");
  return (await res.json()) as StrategiesResponse;
}

async function requestPayout(): Promise<{ payout: Payout }> {
  const res = await fetch("/api/creator/dashboard/request-payout", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "Failed to request payout");
  }
  return (await res.json()) as { payout: Payout };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function payoutStatusClass(status: string): string {
  if (status === "completed" || status === "paid") return "text-emerald-400";
  if (status === "pending" || status === "processing") return "text-amber-400";
  return "text-red-400";
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${highlight ? "text-emerald-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

export function CreatorDashboardClient() {
  const qc = useQueryClient();
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);

  const statsQuery = useQuery({
    queryKey: ["creator", "dashboard", "stats"],
    queryFn: fetchStats,
    staleTime: STALE.SUBSCRIPTIONS,
  });

  const strategiesQuery = useQuery({
    queryKey: ["creator", "dashboard", "strategies"],
    queryFn: fetchStrategies,
    staleTime: STALE.LEADERBOARD,
  });

  const { mutate: doPayout, isPending: isPayoutBusy } = useMutation({
    mutationFn: requestPayout,
    onSuccess: () => {
      setPayoutMsg("Payout requested successfully.");
      void qc.invalidateQueries({ queryKey: ["creator", "dashboard", "stats"] });
    },
    onError: (err: Error) => setPayoutMsg(err.message),
  });

  if (statsQuery.isPending) {
    return <p className="py-16 text-center text-sm text-gray-500">Loading dashboard...</p>;
  }

  const data = statsQuery.data;
  if (!data) {
    return <p className="py-16 text-center text-sm text-red-400">Failed to load dashboard data.</p>;
  }

  const strategies = strategiesQuery.data?.strategies ?? [];
  const creatorPublicId = strategiesQuery.data?.creatorPublicId;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium text-white">Creator Dashboard</h1>
          <p className="mt-1 text-xs text-gray-500">
            Marketplace analytics, published strategies, and payout history.
          </p>
          {data.foundingPublisherSlot !== null && (
            <p className="mt-2 text-xs text-amber-400">
              Founding Publisher — slot #{data.foundingPublisherSlot} of 50
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/marketplace"
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-300 hover:border-white/20 hover:text-white"
          >
            Publish on marketplace →
          </Link>
          {creatorPublicId ? <ShareCreatorProfileButton creatorPublicId={creatorPublicId} /> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Published strategies" value={String(data.totalStrategies)} />
        <StatCard label="Total imports" value={String(data.totalImports)} />
        <StatCard label="Lifetime royalties" value={formatCents(data.totalRoyaltiesCents)} highlight />
        <StatCard label="Available for payout" value={formatCents(data.availableForPayoutCents)} highlight />
        <StatCard label="Pending payouts" value={formatCents(data.pendingPayoutCents)} />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={data.availableForPayoutCents <= 0 || isPayoutBusy}
          onClick={() => doPayout()}
          className="rounded-lg bg-emerald-500 px-6 py-2 text-sm text-white hover:bg-emerald-400 disabled:opacity-50"
        >
          {isPayoutBusy ? "Requesting..." : "Request Payout"}
        </button>
        {payoutMsg ? <span className="text-xs text-gray-400">{payoutMsg}</span> : null}
      </div>

      <section>
        <h2 className="text-sm font-medium text-white">Your published strategies</h2>
        <p className="mt-1 text-xs text-gray-500">
          Aggregate performance benchmarks update weekly from the performance snapshot cron.
        </p>
        {strategiesQuery.isPending ? (
          <p className="mt-4 text-xs text-gray-500">Loading strategies...</p>
        ) : strategies.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/10 py-8 text-center text-sm text-gray-500">
            No published strategies yet.{" "}
            <Link href="/marketplace" className="text-emerald-400 hover:underline">
              Publish from the marketplace
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Strategy</th>
                  <th className="px-4 py-3 text-left">Grade</th>
                  <th className="px-4 py-3 text-left">Imports</th>
                  <th className="px-4 py-3 text-left">Track record</th>
                  <th className="px-4 py-3 text-left">Avg drift</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, i) => (
                  <tr key={s.id} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-4 py-3 text-white">
                      {s.displayName}
                      {s.isFoundingPublisher ? (
                        <span className="ml-2 text-[10px] text-amber-400">★ Founder</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-300">{String(s.strategyGrade)}</td>
                    <td className="px-4 py-3 text-gray-400">{s.importCount}</td>
                    <td className="px-4 py-3 capitalize text-gray-400">
                      {s.performance.consistency}
                      {s.performance.weeksTracked > 0 ? ` (${s.performance.weeksTracked} wk)` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">
                      {s.performance.avgDriftPct != null ? `${s.performance.avgDriftPct.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-white">Payout history</h2>
        {data.recentPayouts.length === 0 ? (
          <p className="mt-4 rounded-xl border border-white/10 py-8 text-center text-sm text-gray-500">
            No payouts yet.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                  <th className="px-4 py-3 text-left">Processed</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayouts.map((p, i) => (
                  <tr key={p.id} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-4 py-3 text-white">{formatCents(p.amount_cents)}</td>
                    <td className={`px-4 py-3 text-xs ${payoutStatusClass(p.status)}`}>{p.status}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(p.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
