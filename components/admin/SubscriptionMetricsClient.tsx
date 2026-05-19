"use client";

import { useEffect, useState } from "react";

interface SubscriptionMetrics {
  summary: {
    totalUsers: number;
    totalActiveSubscriptions: number;
    totalSubscriptions: number;
    currentMrr: number;
    churnedLast30: number;
    newSubscriptionsLast30: number;
    trialConversionRate: number;
    churnRate: number;
  };
  byStatus: Record<string, number>;
  byService: Record<string, number>;
  byGroup: Record<string, number>;
  mrrHistory: Array<{ month: string; mrr: number }>;
  revenueByService: Record<string, number>;
  topServices: Array<{
    serviceKey: string;
    displayName: string;
    subscribers: number;
    annualRevenue: number;
  }>;
}

export function SubscriptionMetricsClient() {
  const [data, setData] = useState<SubscriptionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/subscription-metrics");
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-400">Loading subscription metrics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, byStatus, byGroup, mrrHistory, topServices } = data;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-semibold text-white">Subscription Metrics &mdash; Churn Analysis</h1>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Monthly Recurring Revenue" value={`$${summary.currentMrr.toLocaleString()}`} />
        <MetricCard label="Active Subscriptions" value={String(summary.totalActiveSubscriptions)} />
        <MetricCard label="Churn Rate (30d)" value={`${summary.churnRate}%`} />
        <MetricCard label="Trial Conversion" value={`${summary.trialConversionRate}%`} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Users" value={String(summary.totalUsers)} />
        <MetricCard label="New (30d)" value={String(summary.newSubscriptionsLast30)} />
        <MetricCard label="Churned (30d)" value={String(summary.churnedLast30)} />
        <MetricCard label="Total Subscriptions" value={String(summary.totalSubscriptions)} />
      </div>

      {/* Status breakdown */}
      <section>
        <h2 className="text-lg font-medium text-white mb-3">By Status</h2>
        <div className="grid gap-3 md:grid-cols-5">
          {Object.entries(byStatus).map(([status, count]) => (
            <div key={status}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider">{status}</p>
              <p className="text-2xl font-semibold text-white mt-1">{count}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Group breakdown */}
      <section>
        <h2 className="text-lg font-medium text-white mb-3">Users by Group</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {Object.entries(byGroup).map(([group, count]) => (
            <div key={group}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <p className="text-xs text-gray-500 uppercase tracking-wider">{group}</p>
              <p className="text-2xl font-semibold text-white mt-1">{count}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MRR trend */}
      <section>
        <h2 className="text-lg font-medium text-white mb-3">MRR Trend (last 6 months)</h2>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end gap-3 h-32">
            {mrrHistory.map((h) => {
              const maxMrr = Math.max(...mrrHistory.map((x) => x.mrr), 1);
              const height = Math.max((h.mrr / maxMrr) * 100, 4);
              return (
                <div key={h.month} className="flex flex-col items-center flex-1">
                  <span className="text-[10px] text-gray-500 mb-1">${Math.round(h.mrr)}</span>
                  <div
                    className="w-full bg-emerald-500/40 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-gray-600 mt-1">{h.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Top services */}
      <section>
        <h2 className="text-lg font-medium text-white mb-3">Top Services by Subscribers</h2>
        <div className="space-y-2">
          {topServices.map((svc, i) => (
            <div key={svc.serviceKey}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-5">{i + 1}.</span>
                <div>
                  <p className="text-sm font-medium text-white">{svc.displayName}</p>
                  <p className="text-xs text-gray-500">{svc.serviceKey}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white">{svc.subscribers} subs</p>
                <p className="text-xs text-gray-500">${svc.annualRevenue.toLocaleString()}/yr</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
