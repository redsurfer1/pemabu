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

function FamilyViewInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [scope, setScope] = useState<ViewScope | null>(null);
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
        const data = (await r.json()) as { scope?: ViewScope; error?: string };
        if (!r.ok || data.error) {
          setError(data.error ?? "Access denied.");
          return;
        }
        if (data.scope) setScope(data.scope);
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
            <p className="mt-2 text-3xl font-medium text-white">Live via relay</p>
            <p className="mt-1 text-xs text-gray-600">
              Value is broadcast from the owner&apos;s device in real time. Connect to the same relay session to see
              live data.
            </p>
          </div>
        )}

        {scope.show_drift_status && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-xs text-gray-500">Portfolio Drift Status</p>
            <p className="mt-2 text-lg font-medium text-emerald-400">Live via relay</p>
          </div>
        )}

        {scope.show_allocation_pct && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-xs text-gray-500">Allocation</p>
            <p className="mt-2 text-sm text-gray-400">Aggregated asset-class weights via relay when connected.</p>
          </div>
        )}

        {scope.show_sector_weights && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-xs text-gray-500">Sector weights</p>
            <p className="mt-2 text-sm text-gray-400">Optional scope — relay only, no tickers.</p>
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
