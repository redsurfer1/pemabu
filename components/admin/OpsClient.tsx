"use client";

import { useAdminStats } from "@/hooks/useAdmin";

export function OpsClient() {
  const { data: stats, isPending, error, dataUpdatedAt } = useAdminStats();

  if (isPending) {
    return <div className="text-sm text-gray-400">Loading ops status...</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-400">
        {error instanceof Error ? error.message : "Failed to load stats"}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-white">Ops status</h1>
        <p className="mt-1 text-xs text-gray-500">
          Refreshes every 60 seconds · Last updated:{" "}
          {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "—"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total users" value={stats?.users ?? 0} note="Beta capacity: 5" />
        <StatCard label="Total portfolios" value={stats?.portfolios ?? 0} note="Beta capacity: 20" />
        <StatCard
          label="Open signals"
          value={stats?.unacknowledged_signals ?? 0}
          note="Unacknowledged"
          highlight={(stats?.unacknowledged_signals ?? 0) > 0}
        />
      </div>

      <div className="rounded-xl border border-white/10 p-6">
        <h2 className="mb-4 text-sm font-medium text-white">Market data provider</h2>
        {stats?.market_data_health ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  stats.market_data_health.ok ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              <span className="text-sm text-white">{stats.market_data_health.provider}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  stats.market_data_health.ok
                    ? "bg-emerald-400/10 text-emerald-400"
                    : "bg-red-400/10 text-red-400"
                }`}
              >
                {stats.market_data_health.ok ? "healthy" : "degraded"}
              </span>
            </div>
            <div className="pl-5 text-xs text-gray-500">Latency: {stats.market_data_health.latencyMs}ms</div>
            {stats.market_data_health.message ? (
              <div className="pl-5 text-xs text-amber-400">{stats.market_data_health.message}</div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No health data available</p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 p-6">
        <h2 className="mb-4 text-sm font-medium text-white">Cron schedule</h2>
        <div className="space-y-2">
          {[
            {
              name: "Nightly refresh",
              schedule: "0 2 * * *",
              desc: "Price refresh + drift detection",
            },
            {
              name: "Health check",
              schedule: "0 9 * * *",
              desc: "Provider health + status",
            },
          ].map((job) => (
            <div
              key={job.name}
              className="flex items-center justify-between border-b border-white/5 py-2 last:border-0"
            >
              <div>
                <p className="text-sm text-white">{job.name}</p>
                <p className="text-xs text-gray-500">{job.desc}</p>
              </div>
              <span className="font-mono text-xs text-gray-600">{job.schedule}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-600">
          Cron jobs run automatically on Vercel. Trigger manually via{" "}
          <span className="font-mono">GET /api/cron/nightly-refresh</span> with Bearer token.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  highlight = false,
}: {
  label: string;
  value: number;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 p-5">
      <p className="mb-2 text-xs text-gray-500">{label}</p>
      <p className={`mb-1 text-3xl font-light ${highlight ? "text-amber-400" : "text-white"}`}>{value}</p>
      <p className="text-xs text-gray-600">{note}</p>
    </div>
  );
}
