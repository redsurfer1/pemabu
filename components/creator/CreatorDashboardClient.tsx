"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";

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

async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch("/api/creator/dashboard/stats", {
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return (await res.json()) as DashboardStats;
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
      <p className="text-xs font-medium uppercase tracking-widest text-gray-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${highlight ? "text-emerald-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function CreatorDashboardClient() {
  const qc = useQueryClient();
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["creator", "dashboard", "stats"],
    queryFn: fetchStats,
    staleTime: STALE.SUBSCRIPTIONS,
  });

  const { mutate: doPayout, isPending: isPayoutBusy } = useMutation({
    mutationFn: requestPayout,
    onSuccess: () => {
      setPayoutMsg("Payout requested successfully.");
      void qc.invalidateQueries({ queryKey: ["creator", "dashboard", "stats"] });
    },
    onError: (err: Error) => {
      setPayoutMsg(err.message);
    },
  });

  if (isPending) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-red-400">
        Failed to load dashboard data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-white">Creator Dashboard</h1>
        <p className="mt-1 text-xs text-gray-500">
          Your marketplace royalty analytics and payout history.
        </p>
        {data.foundingPublisherSlot !== null && (
          <p className="mt-2 text-xs text-amber-400">
            Founding Publisher — slot #{data.foundingPublisherSlot} of 50
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Published strategies" value={String(data.totalStrategies)} />
        <StatCard label="Total imports" value={String(data.totalImports)} />
        <StatCard
          label="Lifetime royalties"
          value={formatCents(data.totalRoyaltiesCents)}
          highlight
        />
        <StatCard
          label="Available for payout"
          value={formatCents(data.availableForPayoutCents)}
          highlight
        />
        <StatCard
          label="Pending payouts"
          value={formatCents(data.pendingPayoutCents)}
        />
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
        {payoutMsg && (
          <span className="text-xs text-gray-400">{payoutMsg}</span>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-white">Payout History</h2>
        {data.recentPayouts.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 py-12 text-center">
            <p className="text-sm text-gray-500">No payouts yet.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr className="text-xs text-gray-500">
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                  <th className="px-4 py-3 text-left">Paid</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPayouts.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                  >
                    <td className="px-4 py-3 text-xs text-white">
                      {formatCents(p.amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={
                          p.status === "paid"
                            ? "text-emerald-400"
                            : p.status === "pending"
                              ? "text-amber-400"
                              : "text-red-400"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(p.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
