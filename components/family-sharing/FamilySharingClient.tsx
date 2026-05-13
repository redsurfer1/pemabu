"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface ShareToken {
  id: string;
  viewer_label: string;
  show_total_value: boolean;
  show_drift_status: boolean;
  show_allocation_pct: boolean;
  show_sector_weights: boolean;
  is_active: boolean;
  created_at: string;
  last_accessed_at: string | null;
}

interface CreateTokenResponse {
  token: ShareToken;
  rawToken: string;
  shareUrl: string;
  warning: string;
}

async function fetchTokens(): Promise<ShareToken[]> {
  const res = await fetch("/api/family/tokens", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch tokens");
  const data = (await res.json()) as { tokens: ShareToken[] };
  return data.tokens;
}

async function createToken(payload: {
  viewer_label: string;
  show_total_value: boolean;
  show_drift_status: boolean;
  show_allocation_pct: boolean;
  show_sector_weights: boolean;
}): Promise<CreateTokenResponse> {
  const res = await fetch("/api/family/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create token");
  return (await res.json()) as CreateTokenResponse;
}

async function revokeToken(id: string): Promise<void> {
  const r = await fetch(`/api/family/tokens/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!r.ok) throw new Error("Failed to revoke");
}

export function FamilySharingClient() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newToken, setNewToken] = useState<CreateTokenResponse | null>(null);
  const [form, setForm] = useState({
    viewer_label: "Family View",
    show_total_value: true,
    show_drift_status: true,
    show_allocation_pct: true,
    show_sector_weights: false,
  });

  const { data: tokens = [], isPending } = useQuery({
    queryKey: ["family", "tokens"],
    queryFn: fetchTokens,
    staleTime: 60 * 1000,
  });

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: createToken,
    onSuccess: (result) => {
      setNewToken(result);
      setShowCreate(false);
      void qc.invalidateQueries({ queryKey: ["family", "tokens"] });
    },
  });

  const { mutate: revoke } = useMutation({
    mutationFn: revokeToken,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["family", "tokens"] }),
  });

  const SCOPE_OPTIONS = [
    { key: "show_total_value" as const, label: "Total portfolio value" },
    { key: "show_drift_status" as const, label: "Drift status (OK / Drifted)" },
    { key: "show_allocation_pct" as const, label: "Allocation percentages by asset class" },
    { key: "show_sector_weights" as const, label: "Sector weights" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-white">Family Sharing</h1>
          <p className="mt-1 text-xs text-gray-500">
            Share a read-only view of your portfolio with a spouse or partner. No individual holdings, quantities,
            tickers, or cost basis are exposed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate((v) => !v);
            setNewToken(null);
          }}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:border-white/20"
        >
          {showCreate ? "Cancel" : "+ Create Share Link"}
        </button>
      </div>

      {newToken && (
        <div className="space-y-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-6">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-emerald-400">Share link created — copy it now</p>
            <button
              type="button"
              onClick={() => setNewToken(null)}
              className="text-xs text-gray-500 hover:text-white"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">Share URL (send to viewer)</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={newToken.shareUrl}
                className="flex-1 rounded border border-white/20 bg-white/5 px-3 py-1.5 font-mono text-xs text-white outline-none"
              />
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(newToken.shareUrl)}
                className="rounded border border-white/20 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Copy
              </button>
            </div>
          </div>
          <p className="text-[11px] text-amber-400/80">Warning: {newToken.warning}</p>
        </div>
      )}

      {showCreate && (
        <div className="space-y-5 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Configure Share Link</p>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Viewer label</label>
            <input
              type="text"
              value={form.viewer_label}
              onChange={(e) => setForm((f) => ({ ...f, viewer_label: e.target.value }))}
              placeholder="e.g. Partner view"
              className="w-full rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-xs text-gray-500">What the viewer can see:</p>
            <div className="space-y-2">
              {SCOPE_OPTIONS.map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="h-4 w-4 accent-emerald-400"
                  />
                  <span className="text-xs text-gray-300">{label}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 rounded border border-white/5 bg-white/[0.03] p-3 text-[11px] text-gray-500">
              Individual holdings, tickers, quantities, cost basis, and total wealth are never exposed —
              regardless of scope settings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => create(form)}
            disabled={!form.viewer_label.trim() || isCreating}
            className="rounded-lg bg-emerald-500 px-6 py-2 text-sm text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Generate Share Link"}
          </button>
        </div>
      )}

      {isPending ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading share links...</div>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border border-white/10 py-16 text-center">
          <p className="text-sm text-gray-500">No active share links.</p>
          <p className="mt-1 text-xs text-gray-600">Create a share link to give a family member read-only access.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-xs text-gray-500">
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Scope</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Last accessed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t, i) => {
                const scope = [
                  t.show_total_value && "Total value",
                  t.show_drift_status && "Drift status",
                  t.show_allocation_pct && "Allocation %",
                  t.show_sector_weights && "Sector weights",
                ]
                  .filter(Boolean)
                  .join(", ");

                return (
                  <tr
                    key={t.id}
                    className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                  >
                    <td className="px-4 py-3 text-xs text-white">{t.viewer_label}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{scope || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {t.last_accessed_at ? new Date(t.last_accessed_at).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => revoke(t.id)}
                        className="text-xs text-gray-600 hover:text-red-400"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-[11px] text-gray-600">
        Family Sharing grants read-only access to aggregated portfolio data only. No individual position data is ever
        shared. Not a registered investment advisor — for informational purposes only.
      </p>
    </div>
  );
}
