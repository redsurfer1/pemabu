"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KNOWN_SNAPSHOT_SPACES } from "@/lib/governance/snapshot-client";

interface WatchEntry {
  id: string;
  token_ticker: string;
  token_name: string | null;
  space_id: string | null;
  added_at: string;
}

interface GovernanceProposal {
  id: string;
  token_ticker: string;
  title: string;
  plain_english_summary: string | null;
  state: string;
  vote_deadline: string | null;
  votes_for: number | null;
  votes_against: number | null;
  votes_abstain: number | null;
  quorum_required: number | null;
  url: string | null;
}

interface AlertRow {
  id: string;
  is_read: boolean;
  is_dismissed: boolean;
  alerted_at: string;
  token_ticker: string;
  governance_proposals?: GovernanceProposal | null;
}

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function quorumPct(proposal: GovernanceProposal): number | null {
  const q = proposal.quorum_required;
  if (q == null || !Number.isFinite(Number(q)) || Number(q) <= 0) return null;
  const forVotes = Number(proposal.votes_for ?? 0);
  const against = Number(proposal.votes_against ?? 0);
  return Math.min(100, Math.round(((forVotes + against) / Number(q)) * 100));
}

async function fetchWatchList(): Promise<WatchEntry[]> {
  const res = await fetch("/api/governance/watch-list", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch watch list");
  const data = (await res.json()) as { watchList: WatchEntry[] };
  return data.watchList;
}

async function fetchAlerts(): Promise<AlertRow[]> {
  const res = await fetch("/api/governance/proposals", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Failed to fetch governance proposals");
  const data = (await res.json()) as { alerts: AlertRow[] };
  return data.alerts;
}

async function addToWatchList(ticker: string): Promise<WatchEntry> {
  const res = await fetch("/api/governance/watch-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ token_ticker: ticker }),
  });
  if (!res.ok) throw new Error("Failed to add token");
  const data = (await res.json()) as { watch: WatchEntry };
  return data.watch;
}

async function removeFromWatchList(ticker: string): Promise<void> {
  const r = await fetch(`/api/governance/watch-list/${encodeURIComponent(ticker)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!r.ok) throw new Error("Failed to remove");
}

async function dismissAlert(alertId: string): Promise<void> {
  const r = await fetch(`/api/governance/alerts/${encodeURIComponent(alertId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ is_dismissed: true }),
  });
  if (!r.ok) throw new Error("Failed to dismiss");
}

export function GovernanceClient() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"alerts" | "watch_list">("alerts");
  const [addTicker, setAddTicker] = useState("");

  const { data: watchList = [], isPending: watchLoading } = useQuery({
    queryKey: ["governance", "watch-list"],
    queryFn: fetchWatchList,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: alerts = [],
    isPending: alertsLoading,
    isFetching: alertsFetching,
    isFetched: alertsFetched,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ["governance", "alerts"],
    queryFn: fetchAlerts,
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });

  const { mutate: addToken, isPending: isAdding } = useMutation({
    mutationFn: addToWatchList,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["governance", "watch-list"] });
      setAddTicker("");
    },
  });

  const { mutate: removeToken } = useMutation({
    mutationFn: removeFromWatchList,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["governance", "watch-list"] }),
  });

  const { mutate: dismiss } = useMutation({
    mutationFn: dismissAlert,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["governance", "alerts"] }),
  });

  const resolvedAlerts = alerts.filter((a): a is AlertRow & { governance_proposals: GovernanceProposal } =>
    Boolean(a.governance_proposals),
  );

  const activeAlerts = resolvedAlerts.filter((a) => a.governance_proposals.state === "active");
  const closedAlerts = resolvedAlerts.filter((a) => a.governance_proposals.state !== "active");
  const unreadCount = resolvedAlerts.filter((a) => !a.is_read).length;

  const TABS = [
    { key: "alerts" as const, label: `Proposals${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
    { key: "watch_list" as const, label: "Watch List" },
  ];

  const showAlertsLoading = alertsFetching || alertsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-white">Governance Alert Layer</h1>
          <p className="mt-1 text-xs text-gray-500">
            Monitor governance activity for tokens in your portfolio. Plain-English summaries of active proposals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetchAlerts()}
          disabled={showAlertsLoading}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:border-white/20 disabled:opacity-50"
        >
          {showAlertsLoading ? "Fetching..." : "Refresh Proposals"}
        </button>
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-emerald-400 text-emerald-400"
                : "text-gray-500 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "alerts" && (
        <div className="space-y-4">
          {watchList.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">No tokens on your watch list.</p>
              <p className="mt-1 text-xs text-gray-600">Go to Watch List to add tokens, then Refresh Proposals.</p>
            </div>
          ) : !alertsFetched && !showAlertsLoading ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">Ready to fetch proposals.</p>
              <p className="mt-1 text-xs text-gray-600">Click &quot;Refresh Proposals&quot; to load Snapshot data.</p>
            </div>
          ) : showAlertsLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Fetching governance proposals from Snapshot...
            </div>
          ) : resolvedAlerts.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-16 text-center">
              <p className="text-sm text-gray-500">No proposals found.</p>
              <p className="mt-1 text-xs text-gray-600">Try another token or check again later.</p>
            </div>
          ) : (
            <>
              {activeAlerts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-widest text-emerald-400">
                    Active — Voting Open
                  </p>
                  {activeAlerts.map((alert) => {
                    const p = alert.governance_proposals;
                    const dte = daysUntil(p.vote_deadline);
                    const qpct = quorumPct(p);
                    return (
                      <div
                        key={alert.id}
                        className={`rounded-xl border p-5 ${
                          !alert.is_read
                            ? "border-emerald-400/20 bg-emerald-400/5"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                {p.token_ticker}
                              </span>
                              {dte !== null && (
                                <span
                                  className={`text-[10px] ${dte <= 2 ? "text-red-400" : "text-amber-400"}`}
                                >
                                  {dte <= 0 ? "Ending today" : `${dte}d remaining`}
                                </span>
                              )}
                              {qpct !== null && (
                                <span className="text-[10px] text-gray-500">{qpct}% quorum</span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-sm font-medium text-white">{p.title}</p>
                            {p.plain_english_summary && (
                              <p className="mt-2 text-xs leading-relaxed text-gray-400">{p.plain_english_summary}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            {p.url && (
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-400 hover:text-emerald-300"
                              >
                                View →
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => dismiss(alert.id)}
                              className="text-[11px] text-gray-600 hover:text-gray-400"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {closedAlerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-gray-500">Closed</p>
                  {closedAlerts.map((alert) => {
                    const p = alert.governance_proposals;
                    return (
                      <div
                        key={alert.id}
                        className="rounded-lg border border-white/5 bg-white/[0.01] p-4 opacity-60"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="mr-2 text-[10px] font-medium text-gray-500">{p.token_ticker}</span>
                            <span className="text-xs text-gray-400">{p.title}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => dismiss(alert.id)}
                            className="ml-4 shrink-0 text-[11px] text-gray-700 hover:text-gray-500"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "watch_list" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-gray-500">Add Token to Watch List</p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Token ticker (e.g. UNI, AAVE, COMP)"
                value={addTicker}
                onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
                className="flex-1 rounded border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-xs text-white placeholder-gray-600 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (addTicker.trim()) addToken(addTicker.trim());
                }}
                disabled={!addTicker.trim() || isAdding}
                className="rounded-lg bg-emerald-500 px-5 py-1.5 text-sm text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {isAdding ? "Adding..." : "Add"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {Object.keys(KNOWN_SNAPSHOT_SPACES).map((ticker) => (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => setAddTicker(ticker)}
                  className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-gray-500 hover:border-white/20 hover:text-white"
                >
                  {ticker}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-gray-600">
              Well-known tokens auto-resolve to their Snapshot space. For others, set a Snapshot space ID via API
              support later.
            </p>
          </div>

          {watchLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading watch list...</div>
          ) : watchList.length === 0 ? (
            <div className="rounded-xl border border-white/10 py-12 text-center">
              <p className="text-sm text-gray-500">No tokens on your watch list yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-3 text-left">Token</th>
                    <th className="px-4 py-3 text-left">Snapshot Space</th>
                    <th className="px-4 py-3 text-left">Added</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {watchList.map((w, i) => (
                    <tr
                      key={w.id}
                      className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-white">{w.token_ticker}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {w.space_id ?? (
                          <span className="text-amber-400/70">No Snapshot space — proposals unavailable</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(w.added_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeToken(w.token_ticker)}
                          className="text-xs text-gray-600 hover:text-red-400"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-gray-600">
        Governance data sourced from Snapshot.org public API. Not a registered investment advisor — for informational
        purposes only.
      </p>
    </div>
  );
}
