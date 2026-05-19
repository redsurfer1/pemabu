"use client";

import { useCallback, useEffect, useState } from "react";
import type { PemabuService } from "@/lib/types/database";

type EnrichedSubscription = Record<string, unknown> & {
  service_key: string;
  status: string;
  renewal_mode: string | null;
  ends_at: string | null;
  is_active: boolean;
  service: PemabuService | null;
};

type TierKey = "core_v1" | "intelligence_annual" | "autonomous_annual";

const TIER_ORDER: TierKey[] = ["core_v1", "intelligence_annual", "autonomous_annual"];
const TIER_LABELS: Record<string, string> = {
  core_v1: "Core",
  intelligence_annual: "Intelligence",
  autonomous_annual: "Autonomous",
};

interface SubscriptionManagerProps {
  userId: string;
  userEmail: string;
  services: PemabuService[];
}

export function SubscriptionManager({ services }: SubscriptionManagerProps) {
  const [subs, setSubs] = useState<EnrichedSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSubs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/workspace/subscriptions");
      if (!res.ok) throw new Error("Failed to load subscriptions");
      const data = await res.json();
      setSubs(data.subscriptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const activeSubs = subs.filter((s) => s.is_active);
  const hasActiveTier = activeSubs.some((s) => TIER_ORDER.includes(s.service_key as TierKey));
  const activeTierKey = TIER_ORDER.find((t) => activeSubs.some((s) => s.service_key === t));

  const handlePurchase = async (serviceKey: string, renewalMode: "auto" | "manual") => {
    setActionLoading(serviceKey);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/stripe/create-subscription-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_key: serviceKey, renewal_mode: renewalMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (serviceKey: string) => {
    if (!confirm("Cancel this subscription? It will expire immediately.")) return;
    setActionLoading(serviceKey);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/workspace/subscriptions/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetServiceKey: serviceKey, action: "cancel" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Cancel failed");
      }
      setSuccessMsg(`${serviceKey} cancelled.`);
      await fetchSubs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    setActionLoading("portal");
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Portal failed");
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
    } finally {
      setActionLoading(null);
    }
  };

  const tierServices = services.filter((s) => TIER_ORDER.includes(s.service_key as TierKey));
  const addonServices = services.filter(
    (s) => s.category === "addon" && s.service_key !== "v1_to_v2_upgrade",
  );

  if (loading) {
    return <p className="text-sm text-gray-400">Loading subscriptions…</p>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}
      {successMsg && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{successMsg}</div>
      )}

      {/* Current subscriptions */}
      <section>
        <h2 className="text-lg font-medium text-white mb-4">Your Subscriptions</h2>
        {activeSubs.length === 0 ? (
          <p className="text-sm text-gray-500">No active subscriptions.</p>
        ) : (
          <div className="space-y-3">
            {activeSubs.map((sub) => (
              <div key={sub.service_key as string}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-white">{sub.service?.display_name ?? (sub.service_key as string)}</p>
                  <p className="text-xs text-gray-500">
                    {sub.renewal_mode === "auto" ? "Auto-renewal" : sub.renewal_mode === "manual" ? "Annual (manual)" : "One-time"}
                    {sub.ends_at ? ` · expires ${new Date(sub.ends_at as string).toLocaleDateString()}` : ""}
                    <span className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] ${
                      sub.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                      sub.status === "trial" ? "bg-blue-500/20 text-blue-400" :
                      "bg-gray-500/20 text-gray-400"
                    }`}>{sub.status}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {sub.renewal_mode === "auto" && (
                    <button onClick={handlePortal} disabled={actionLoading === "portal"}
                      className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:border-white/20 hover:text-white"
                    >
                      {actionLoading === "portal" ? "…" : "Manage in Stripe"}
                    </button>
                  )}
                  <button onClick={() => handleCancel(sub.service_key as string)} disabled={actionLoading === sub.service_key}
                    className="rounded border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {actionLoading === sub.service_key ? "…" : "Cancel"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tier subscriptions */}
      <section>
        <h2 className="text-lg font-medium text-white mb-4">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {tierServices.map((svc) => {
            const activeSub = activeSubs.find((s) => s.service_key === svc.service_key);
            const owned = !!activeSub;
            const isCurrent = activeTierKey === svc.service_key;
            return (
              <div key={svc.service_key} className={`rounded-xl border p-5 ${
                isCurrent ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-white/10 bg-white/[0.03]"
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-medium text-white">{TIER_LABELS[svc.service_key] ?? svc.display_name}</h3>
                  {isCurrent && <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">Current</span>}
                  {owned && !isCurrent && <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400">Owned</span>}
                </div>
                <p className="text-2xl font-semibold text-white">
                  ${svc.price_usd}<span className="text-sm font-normal text-gray-500">/yr</span>
                </p>
                <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-3">{svc.description}</p>
                <div className="mt-4 space-y-2">
                  {owned ? (
                    <button onClick={() => handleCancel(svc.service_key)} disabled={actionLoading === svc.service_key}
                      className="w-full rounded border border-red-500/30 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {actionLoading === svc.service_key ? "…" : "Cancel plan"}
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handlePurchase(svc.service_key, "auto")} disabled={actionLoading === svc.service_key}
                        className="w-full rounded bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {actionLoading === svc.service_key ? "…" : "Subscribe (auto)"}
                      </button>
                      <button onClick={() => handlePurchase(svc.service_key, "manual")} disabled={actionLoading === svc.service_key}
                        className="w-full rounded border border-white/10 px-4 py-2 text-xs text-gray-400 hover:border-white/20 disabled:opacity-50"
                      >
                        {actionLoading === svc.service_key ? "…" : "Pay manually"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add-on subscriptions */}
      <section>
        <h2 className="text-lg font-medium text-white mb-4">Add-ons</h2>
        {!hasActiveTier && <p className="text-xs text-gray-500 mb-3">Subscribe to a plan above to enable add-on purchases.</p>}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {addonServices.filter((s) => s.is_active).map((svc) => {
            const owned = activeSubs.some((s) => s.service_key === svc.service_key);
            return (
              <div key={svc.service_key} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-medium text-white">{svc.display_name}</h3>
                  {owned && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">Active</span>}
                </div>
                <p className="text-lg font-medium text-white">
                  ${svc.price_usd}<span className="text-xs font-normal text-gray-500">/yr</span>
                </p>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{svc.description}</p>
                <div className="mt-3">
                  {owned ? (
                    <button onClick={() => handleCancel(svc.service_key)} disabled={actionLoading === svc.service_key}
                      className="w-full rounded border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {actionLoading === svc.service_key ? "…" : "Remove"}
                    </button>
                  ) : (
                    <button onClick={() => handlePurchase(svc.service_key, "auto")} disabled={actionLoading === svc.service_key || !hasActiveTier}
                      className="w-full rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:border-white/20 hover:text-white disabled:opacity-30"
                    >
                      {actionLoading === svc.service_key ? "…" : !hasActiveTier ? "Requires plan" : "Add"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
