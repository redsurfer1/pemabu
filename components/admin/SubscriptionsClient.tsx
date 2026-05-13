"use client";

import { Fragment, useState } from "react";
import { useAdminUsers, useAdminPricing } from "@/hooks/useAdmin";
import type { SubscriptionGroup } from "@/lib/types/database";

const GROUP_LABELS: Record<SubscriptionGroup, string> = {
  beta: "Beta — Full Access (Complimentary)",
  standard: "Standard — Market Price",
  trial: "Trial — 30-Day Full Access",
  alumni: "Alumni — Was Beta, Now Market Price",
};

const GROUP_COLORS: Record<SubscriptionGroup, string> = {
  beta: "bg-violet-400/10 text-violet-400",
  standard: "bg-emerald-400/10 text-emerald-400",
  trial: "bg-blue-400/10 text-blue-400",
  alumni: "bg-gray-500/10 text-gray-400",
};

export function SubscriptionsClient() {
  const { data: users = [], isPending: usersPending, error: usersError } = useAdminUsers();
  const { groupAssignments, assignUserGroup, subscriptions, services } = useAdminPricing();

  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SubscriptionGroup>("standard");
  const [groupNotes, setGroupNotes] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const isPending = usersPending || groupAssignments.isPending || subscriptions.isPending || services.isPending;
  const error = usersError ?? groupAssignments.error ?? subscriptions.error ?? services.error;

  const activeServiceCount = (services.data ?? []).filter((s) => s.is_active).length;

  if (isPending) {
    return <div className="text-sm text-gray-400">Loading subscriptions…</div>;
  }
  if (error) {
    return (
      <div className="text-sm text-red-400">
        {error instanceof Error ? error.message : "Failed to load data"}
      </div>
    );
  }

  const assignmentsByUser = Object.fromEntries(
    (groupAssignments.data ?? []).map((a) => [a.user_id, a]),
  );
  const subsByUser: Record<string, typeof subscriptions.data> = {};
  for (const sub of subscriptions.data ?? []) {
    if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
    subsByUser[sub.user_id]!.push(sub);
  }

  const modalUser = users.find((u) => u.id === modalUserId);
  const currentAssignment = modalUserId ? assignmentsByUser[modalUserId] : null;

  async function handleAssign() {
    if (!modalUserId) return;
    setModalError(null);
    try {
      await assignUserGroup.mutateAsync({
        user_id: modalUserId,
        subscription_group: selectedGroup,
        notes: groupNotes || null,
      });
      setModalUserId(null);
      setGroupNotes("");
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Assignment failed");
    }
  }

  function openModal(userId: string) {
    const current = assignmentsByUser[userId];
    setSelectedGroup(current?.subscription_group ?? "standard");
    setGroupNotes("");
    setModalError(null);
    setModalUserId(userId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-white">Subscriptions</h1>
        <p className="mt-1 text-xs text-gray-500">
          {users.length} user{users.length !== 1 ? "s" : ""} · Assign groups and manage access
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10">
            <tr className="text-xs text-gray-500">
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Group</th>
              <th className="px-4 py-3 text-left">Subscriptions</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => {
              const assignment = assignmentsByUser[user.id];
              const group = assignment?.subscription_group;
              const userSubs = subsByUser[user.id] ?? [];
              const isExpanded = expandedUserId === user.id;
              const rowBg = i % 2 === 0 ? "bg-white/[0.03]" : "";

              return (
                <Fragment key={user.id}>
                  <tr className={`border-b border-white/5 ${rowBg}`}>
                    <td className="px-4 py-3 font-mono text-xs text-white">{user.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      {group ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs ${GROUP_COLORS[group]}`}>
                          {GROUP_LABELS[group]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {userSubs.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          {userSubs.length} subscription{userSubs.length !== 1 ? "s" : ""}
                          {isExpanded ? " ▲" : " ▼"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openModal(user.id)}
                        className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:text-white"
                      >
                        Assign group
                      </button>
                    </td>
                  </tr>

                  {isExpanded && userSubs.length > 0 && (
                    <tr className={`border-b border-white/5 ${rowBg}`}>
                      <td colSpan={4} className="px-6 pb-3 pt-0">
                        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="pb-1 text-left">Service</th>
                                <th className="pb-1 text-left">Status</th>
                                <th className="pb-1 text-right">Price paid</th>
                                <th className="pb-1 text-left">Since</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userSubs.map((sub) => (
                                <tr key={sub.id} className="border-t border-white/5">
                                  <td className="py-1 font-mono text-gray-300">
                                    {sub.service?.display_name ?? sub.service_key}
                                  </td>
                                  <td className="py-1">
                                    <StatusBadge status={sub.status} />
                                  </td>
                                  <td className="py-1 text-right text-gray-400">
                                    {sub.price_paid_usd != null
                                      ? `$${sub.price_paid_usd.toFixed(2)}`
                                      : "—"}
                                  </td>
                                  <td className="py-1 text-gray-500">
                                    {new Date(sub.starts_at).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Group assignment modal */}
      {modalUserId && modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0D1F3C] p-6 shadow-2xl">
            <h2 className="mb-1 text-base font-medium text-white">Assign Group</h2>
            <p className="mb-4 font-mono text-xs text-gray-500">{modalUser.email}</p>

            {currentAssignment && (
              <p className="mb-3 text-xs text-gray-400">
                Current group:{" "}
                <span className={`rounded-full px-2 py-0.5 ${GROUP_COLORS[currentAssignment.subscription_group]}`}>
                  {GROUP_LABELS[currentAssignment.subscription_group]}
                </span>
              </p>
            )}

            <div className="mb-4 space-y-2">
              {(["beta", "standard", "trial", "alumni"] as SubscriptionGroup[]).map((g) => (
                <label key={g} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3 transition-colors hover:border-white/20">
                  <input
                    type="radio"
                    name="group"
                    value={g}
                    checked={selectedGroup === g}
                    onChange={() => setSelectedGroup(g)}
                    className="mt-0.5 accent-violet-400"
                  />
                  <div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${GROUP_COLORS[g]}`}>
                      {GROUP_LABELS[g]}
                    </span>
                    {g === "beta" && (
                      <p className="mt-1 text-xs text-violet-300/80">
                        Assigning beta will automatically grant all {activeServiceCount} active services to this user
                        at no charge. This subscription is perpetual as long as beta membership continues.
                      </p>
                    )}
                    {g === "alumni" && (
                      <p className="mt-1 text-xs text-gray-500">
                        Moving to Alumni will cancel all complimentary beta subscriptions. This user will be charged
                        market price if they resubscribe to any service.
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs text-gray-500">Notes (optional)</label>
              <input
                type="text"
                value={groupNotes}
                onChange={(e) => setGroupNotes(e.target.value)}
                placeholder="Reason for assignment…"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder:text-gray-600 focus:border-white/20"
              />
            </div>

            {modalError && (
              <p className="mb-3 text-xs text-red-400">{modalError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleAssign()}
                disabled={assignUserGroup.isPending}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {assignUserGroup.isPending ? "Saving…" : "Assign"}
              </button>
              <button
                type="button"
                onClick={() => setModalUserId(null)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 transition-colors hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-400/10 text-emerald-400",
    complimentary: "bg-violet-400/10 text-violet-400",
    trial: "bg-blue-400/10 text-blue-400",
    cancelled: "bg-gray-500/10 text-gray-500",
    expired: "bg-red-400/10 text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status] ?? "text-gray-400"}`}>
      {status}
    </span>
  );
}
