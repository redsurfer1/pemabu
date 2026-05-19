"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface ViewScope {
  owner_user_id: string;
  viewer_label: string;
  show_total_value: boolean;
  show_drift_status: boolean;
  show_allocation_pct: boolean;
  show_sector_weights: boolean;
}

interface PortfolioData {
  totalValue: number | null;
  driftStatus: "ok" | "drifted" | "unknown";
  allocations: { assetClass: string; pct: number }[];
  sectorWeights: { sector: string; pct: number }[];
  lastUpdated: string | null;
}

interface ViewApiResponse {
  scope?: ViewScope;
  portfolio?: PortfolioData;
  error?: string;
}

const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: "Equities",
  fixed_income: "Fixed Income",
  alternatives: "Alternatives",
  cash: "Cash",
  crypto: "Crypto",
  other: "Other",
};

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "bg-blue-500",
  fixed_income: "bg-emerald-500",
  alternatives: "bg-purple-500",
  cash: "bg-gray-400",
  crypto: "bg-amber-500",
  other: "bg-slate-500",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function DriftBadge({ status }: { status: string }) {
  if (status === "ok") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-400">On Track</span>;
  }
  if (status === "drifted") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-400">Drifted</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-3 py-1 text-xs font-medium text-gray-500">Unknown</span>;
}

function BarChart({ items, maxPct }: { items: { label: string; pct: number; color: string }[]; maxPct?: number }) {
  const cap = maxPct ?? Math.max(...items.map((i) => i.pct), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-400">{item.label}</span>
            <span className="text-xs text-gray-500">{item.pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${item.color}`}
              style={{ width: `${Math.min((item.pct / cap) * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FamilyViewInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [scope, setScope] = useState<ViewScope | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("No token provided.");
      setLoading(false);
      return;
    }

    void fetch(`/api/family/view?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = (await r.json()) as ViewApiResponse;
        if (!r.ok || data.error) {
          setError(data.error ?? "Access denied.");
          return;
        }
        if (data.scope) setScope(data.scope);
        if (data.portfolio) setPortfolio(data.portfolio);
      })
      .catch(() => setError("Failed to verify token."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A1628]">
        <p className="text-sm text-gray-400">Verifying access...</p>
      </div>
    );
  }

  if (error || !scope) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A1628]">
        <div className="max-w-md rounded-xl border border-red-400/20 bg-red-400/5 p-8 text-center">
          <p className="text-sm font-medium text-red-400">Access Denied</p>
          <p className="mt-2 text-xs text-gray-400">
            {error ?? "This share link is invalid or has been revoked."}
          </p>
        </div>
      </div>
    );
  }

  const portfolioUnavailable = !portfolio || portfolio.totalValue === null;

  return (
    <div className="min-h-screen bg-[#0A1628] px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-gray-500">Pemabu</p>
          <h1 className="mt-1 text-xl font-medium text-white">{scope.viewer_label}</h1>
          <p className="mt-1 text-xs text-gray-500">Read-only portfolio summary</p>
        </div>

        {scope.show_total_value && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-xs text-gray-500">Total Portfolio Value</p>
            {portfolioUnavailable ? (
              <>
                <p className="mt-2 text-sm text-gray-400">Portfolio data temporarily unavailable</p>
                <p className="mt-1 text-xs text-gray-600">
                  The owner&apos;s portfolio has not been set up or data has not been refreshed yet.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-3xl font-medium text-white">{formatCurrency(portfolio.totalValue ?? 0)}</p>
                {portfolio.lastUpdated && (
                  <p className="mt-1 text-xs text-gray-600">
                    As of {new Date(portfolio.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {scope.show_drift_status && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Portfolio Drift Status</p>
              <DriftBadge status={portfolioUnavailable ? "unknown" : portfolio.driftStatus} />
            </div>
            {portfolioUnavailable ? (
              <p className="mt-3 text-xs text-gray-500">Drift data unavailable until portfolio is refreshed.</p>
            ) : (
              <>
                {portfolio.allocations.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {portfolio.allocations.map((a) => {
                      const target = { equity: 38, fixed_income: 28, alternatives: 22, cash: 12, crypto: 0, other: 0 }[a.assetClass] ?? 0;
                      const diff = a.pct - target;
                      const drifted = Math.abs(diff) >= 5;
                      return (
                        <div key={a.assetClass} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">{ASSET_CLASS_LABELS[a.assetClass] ?? a.assetClass}</span>
                          <span className={drifted ? "text-amber-400" : "text-gray-500"}>
                            {a.pct.toFixed(1)}% {drifted ? `(${diff > 0 ? "+" : ""}${diff.toFixed(1)}%)` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {scope.show_allocation_pct && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="mb-4 text-xs text-gray-500">Allocation by Asset Class</p>
            {portfolioUnavailable || portfolio.allocations.length === 0 ? (
              <p className="text-sm text-gray-400">Portfolio data temporarily unavailable</p>
            ) : (
              <BarChart
                items={portfolio.allocations
                  .filter((a) => a.pct > 0)
                  .map((a) => ({
                    label: ASSET_CLASS_LABELS[a.assetClass] ?? a.assetClass,
                    pct: a.pct,
                    color: ASSET_CLASS_COLORS[a.assetClass] ?? "bg-slate-500",
                  }))}
              />
            )}
          </div>
        )}

        {scope.show_sector_weights && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <p className="mb-4 text-xs text-gray-500">Sector Weights</p>
            {portfolioUnavailable || portfolio.sectorWeights.length === 0 ? (
              <p className="text-sm text-gray-400">Sector data is not yet available for this portfolio.</p>
            ) : (
              <BarChart
                items={portfolio.sectorWeights.map((s) => ({
                  label: s.sector,
                  pct: s.pct,
                  color: "bg-indigo-500",
                }))}
              />
            )}
          </div>
        )}

        <div className="rounded-lg border border-white/5 p-4">
          <p className="text-center text-[11px] leading-relaxed text-gray-600">
            This view is shared by the portfolio owner. No individual holdings, quantities, tickers, or cost basis are
            visible here. Not a registered investment advisor — for informational purposes only.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FamilyViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0A1628]">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      }
    >
      <FamilyViewInner />
    </Suspense>
  );
}
