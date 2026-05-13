"use client";

import { useState } from "react";
import { useAdminPricing } from "@/hooks/useAdmin";
import type { PemabuService, PricingModel, ServiceCategory } from "@/lib/types/database";

const CATEGORY_ORDER: ServiceCategory[] = ["core", "subscription", "addon", "upgrade", "overage"];

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  core: "Core",
  subscription: "Subscription",
  addon: "Add-on",
  upgrade: "Upgrade",
  overage: "Overage",
};

const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  one_time: "One-time",
  annual: "Annual",
  per_event: "Per event",
};

function formatPriceCell(svc: PemabuService): string {
  if (svc.pricing_model === "per_event") {
    return `$${svc.price_usd.toFixed(2)} / sim`;
  }
  return `$${svc.price_usd.toFixed(2)}`;
}

export function PricingClient() {
  const { services, updateService } = useAdminPricing();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<PemabuService>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  if (services.isPending) {
    return <div className="text-sm text-gray-400">Loading services…</div>;
  }
  if (services.error) {
    return (
      <div className="text-sm text-red-400">
        {services.error instanceof Error ? services.error.message : "Failed to load services"}
      </div>
    );
  }

  const allServices = services.data ?? [];
  const grouped = CATEGORY_ORDER.reduce<Record<ServiceCategory, PemabuService[]>>(
    (acc, cat) => {
      acc[cat] = allServices.filter((s) => s.category === cat);
      return acc;
    },
    { core: [], subscription: [], addon: [], upgrade: [], overage: [] },
  );

  function startEdit(svc: PemabuService) {
    setEditingKey(svc.service_key);
    setDraft({
      display_name: svc.display_name,
      description: svc.description,
      price_usd: svc.price_usd,
      is_active: svc.is_active,
    });
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraft({});
    setSaveError(null);
  }

  async function saveEdit(service_key: string) {
    setSaveError(null);
    try {
      await updateService.mutateAsync({ service_key, ...draft });
      setEditingKey(null);
      setDraft({});
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-white">Pricing</h1>
        <p className="mt-1 text-xs text-gray-500">
          {allServices.length} service{allServices.length !== 1 ? "s" : ""} · catalog order
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-100/90">
        Price changes affect new purchases only. Active subscriptions and beta users are not affected. Beta users
        always receive all services at no charge regardless of catalog price.
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {saveError}
        </div>
      )}

      {CATEGORY_ORDER.map((cat) => {
        const rows = grouped[cat];
        if (rows.length === 0) return null;
        return (
          <div key={cat} className="overflow-hidden rounded-xl border border-white/10">
            <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {CATEGORY_LABELS[cat]}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-white/5">
                <tr className="text-xs text-gray-500">
                  <th className="px-4 py-2 text-left">Key</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Model</th>
                  <th className="px-4 py-2 text-right">Price (USD)</th>
                  <th className="px-4 py-2 text-center">Active</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((svc, i) => {
                  const isEditing = editingKey === svc.service_key;
                  const rowBg = i % 2 === 0 ? "bg-white/[0.02]" : "";
                  const inactiveStyle = !svc.is_active && !isEditing ? "opacity-50" : "";
                  return (
                    <tr key={svc.service_key} className={`border-b border-white/5 ${rowBg} ${inactiveStyle}`}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{svc.service_key}</td>

                      <td className="px-4 py-2 text-xs text-white">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white outline-none focus:border-blue-400"
                            value={draft.display_name ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                          />
                        ) : (
                          svc.display_name
                        )}
                      </td>

                      <td className="px-4 py-2 text-xs text-gray-400">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-xs text-white outline-none focus:border-blue-400"
                            value={draft.description ?? ""}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, description: e.target.value || null }))
                            }
                          />
                        ) : (
                          svc.description ?? "—"
                        )}
                      </td>

                      <td className="px-4 py-2 text-xs text-gray-400">
                        {PRICING_MODEL_LABELS[svc.pricing_model]}
                      </td>

                      <td className="px-4 py-2 text-right text-xs text-white">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-24 rounded border border-white/20 bg-white/10 px-2 py-1 text-right text-xs text-white outline-none focus:border-blue-400"
                            value={draft.price_usd ?? 0}
                            onChange={(e) =>
                              setDraft((d) => ({ ...d, price_usd: parseFloat(e.target.value) || 0 }))
                            }
                          />
                        ) : (
                          formatPriceCell(svc)
                        )}
                      </td>

                      <td className="px-4 py-2 text-center">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={draft.is_active ?? true}
                            onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                            className="accent-emerald-400"
                          />
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              svc.is_active
                                ? "bg-emerald-400/10 text-emerald-400"
                                : "bg-gray-500/10 text-gray-500"
                            }`}
                          >
                            {svc.is_active ? "Yes" : "No"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-2 text-right text-xs">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void saveEdit(svc.service_key)}
                              disabled={updateService.isPending}
                              className="rounded px-2 py-1 text-xs text-emerald-400 transition-colors hover:bg-emerald-400/10 disabled:opacity-50"
                            >
                              {updateService.isPending ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(svc)}
                            disabled={editingKey !== null}
                            className="rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
