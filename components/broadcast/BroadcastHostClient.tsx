"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface BroadcastSession {
  id: string;
  portfolio_id: string;
  viewer_token: string;
  viewer_url: string;
  is_live: boolean;
  last_ping_at: string | null;
  expires_at: string;
}

interface Portfolio {
  id: string;
  name: string;
}

async function fetchSessions(): Promise<BroadcastSession[]> {
  const res = await fetch("/api/broadcast/session");
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { sessions: BroadcastSession[] };
  return data.sessions;
}

async function createSession(portfolio_id: string): Promise<{ session: BroadcastSession; viewer_url: string }> {
  const res = await fetch("/api/broadcast/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portfolio_id }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ session: BroadcastSession; viewer_url: string }>;
}

async function updateSession(token: string, action: "go_live" | "stop_live" | "ping") {
  const res = await fetch("/api/broadcast/session", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function BroadcastHostClient({ portfolios }: { portfolios: Portfolio[] }) {
  const qc = useQueryClient();
  const [selectedPortfolio, setSelectedPortfolio] = useState(portfolios[0]?.id ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["broadcast-sessions"],
    queryFn: fetchSessions,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: () => createSession(selectedPortfolio),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["broadcast-sessions"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ token, action }: { token: string; action: "go_live" | "stop_live" }) =>
      updateSession(token, action),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["broadcast-sessions"] }),
  });

  const sessions = sessionsQuery.data ?? [];
  const liveSession = sessions.find((s) => s.is_live);

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-6">
      {liveSession && (
        <div className="bg-emerald-900/30 border border-emerald-500/40 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-300 font-medium text-sm">LIVE</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs text-gray-400 bg-white/10 px-3 py-1.5 rounded-lg break-all">
              {liveSession.viewer_url}
            </span>
            <button
              onClick={() => void copyUrl(liveSession.viewer_url)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 text-xs rounded-lg transition-colors"
            >
              {copied === liveSession.viewer_url ? "Copied!" : "Copy link"}
            </button>
          </div>
          <button
            onClick={() => updateMutation.mutate({ token: liveSession.viewer_token, action: "stop_live" })}
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
          >
            Stop Broadcast
          </button>
        </div>
      )}

      <div className="bg-white/5 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-gray-300">Start New Broadcast</h3>

        {portfolios.length > 1 && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Portfolio</label>
            <select
              value={selectedPortfolio}
              onChange={(e) => setSelectedPortfolio(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 rounded-lg text-sm text-white border border-white/10 focus:outline-none focus:border-emerald-500"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !selectedPortfolio}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {createMutation.isPending ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : null}
          Create Broadcast Session
        </button>

        {createMutation.data && !liveSession && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            <p className="text-xs text-gray-400">Share this link with viewers, then go live:</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-xs text-gray-300 bg-white/10 px-3 py-1.5 rounded-lg break-all">
                {createMutation.data.viewer_url}
              </span>
              <button
                onClick={() => void copyUrl(createMutation.data!.viewer_url)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 text-xs rounded-lg transition-colors"
              >
                {copied === createMutation.data.viewer_url ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              onClick={() =>
                updateMutation.mutate({
                  token: createMutation.data!.session.viewer_token,
                  action: "go_live",
                })
              }
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
            >
              Go Live
            </button>
          </div>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Sessions</h3>
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 gap-4">
              <div className="flex items-center gap-2 min-w-0">
                {s.is_live && <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />}
                <span className="font-mono text-xs text-gray-400 truncate">{s.viewer_url}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => void copyUrl(s.viewer_url)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {copied === s.viewer_url ? "Copied!" : "Copy"}
                </button>
                {!s.is_live && (
                  <button
                    onClick={() => updateMutation.mutate({ token: s.viewer_token, action: "go_live" })}
                    className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    Go Live
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
