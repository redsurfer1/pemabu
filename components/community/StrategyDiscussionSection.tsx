"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";

type Discussion = {
  id: string;
  strategy_id: string;
  user_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  reply_count: number;
  author_name: string | null;
};

type Reply = {
  id: string;
  discussion_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
};

type Props = {
  strategyId: string;
};

export function StrategyDiscussionSection({ strategyId }: Props) {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["community", "discussions", strategyId],
    queryFn: async () => {
      const res = await fetch(`/api/community/discussions/${strategyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load discussions");
      return res.json() as Promise<{ discussions: Discussion[] }>;
    },
    staleTime: STALE.LEADERBOARD,
  });

  const discussions = data?.discussions ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/community/discussions/${strategyId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, body: newBody }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to create" }));
        throw new Error(err.error ?? "Failed to create discussion");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewTitle("");
      setNewBody("");
      setShowNewForm(false);
      qc.invalidateQueries({ queryKey: ["community", "discussions", strategyId] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (discussionId: string) => {
      const body = replyBodies[discussionId] ?? "";
      const res = await fetch(`/api/community/discussions/${strategyId}/${discussionId}/reply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to reply" }));
        throw new Error(err.error ?? "Failed to post reply");
      }
      return res.json();
    },
    onSuccess: (_data, discussionId) => {
      setReplyBodies((prev) => ({ ...prev, [discussionId]: "" }));
      qc.invalidateQueries({ queryKey: ["community", "discussions", strategyId] });
      qc.invalidateQueries({ queryKey: ["community", "replies", discussionId] });
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">
          {discussions.length > 0
            ? `${discussions.length} discussion${discussions.length !== 1 ? "s" : ""}`
            : "No discussions yet"}
        </span>
        <button
          type="button"
          onClick={() => setShowNewForm((v) => !v)}
          className="rounded border border-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/5"
        >
          {showNewForm ? "Cancel" : "Start discussion"}
        </button>
      </div>

      {showNewForm && (
        <div className="space-y-3 rounded border border-white/10 bg-black/30 p-4">
          <input
            className="w-full rounded border border-white/10 bg-[#0d1524] px-3 py-2 text-sm text-white"
            placeholder="Discussion title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={200}
          />
          <textarea
            className="h-24 w-full rounded border border-white/10 bg-[#0d1524] p-3 text-sm text-white"
            placeholder="What's on your mind?"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            maxLength={5000}
          />
          <button
            type="button"
            disabled={createMutation.isPending || !newTitle.trim() || !newBody.trim()}
            onClick={() => createMutation.mutate()}
            className="rounded border border-sky-500/40 bg-sky-950/30 px-4 py-1 text-xs text-sky-100 hover:bg-sky-950/50 disabled:opacity-40"
          >
            {createMutation.isPending ? "Posting..." : "Post discussion"}
          </button>
          {createMutation.isError && (
            <p className="text-xs text-red-400">{(createMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500">Loading discussions...</p>
      ) : (
        <div className="space-y-3">
          {discussions.map((discussion) => {
            const isExpanded = expandedId === discussion.id;
            return (
              <div key={discussion.id} className="rounded border border-white/5 bg-black/20">
                <button
                  type="button"
                  onClick={() => toggleExpand(discussion.id)}
                  className="flex w-full items-start justify-between p-3 text-left hover:bg-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {discussion.is_pinned && (
                        <span className="text-[10px] text-yellow-500">Pinned</span>
                      )}
                      <span className="text-sm font-medium text-white truncate">{discussion.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{discussion.body}</p>
                    <div className="mt-1 text-[10px] text-gray-600">
                      {discussion.author_name ?? "Anonymous"} &middot;{" "}
                      {new Date(discussion.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="ml-3 shrink-0 text-[11px] text-gray-500">
                    {discussion.reply_count} repl{discussion.reply_count === 1 ? "y" : "ies"}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/5 p-3 space-y-3">
                    <RepliesList discussionId={discussion.id} strategyId={strategyId} />
                    <div className="flex gap-2">
                      <input
                        className="flex-1 rounded border border-white/10 bg-[#0d1524] px-3 py-1.5 text-xs text-white"
                        placeholder="Write a reply..."
                        value={replyBodies[discussion.id] ?? ""}
                        onChange={(e) =>
                          setReplyBodies((prev) => ({ ...prev, [discussion.id]: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        disabled={replyMutation.isPending || !(replyBodies[discussion.id] ?? "").trim()}
                        onClick={() => replyMutation.mutate(discussion.id)}
                        className="rounded border border-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40"
                      >
                        {replyMutation.isPending ? "..." : "Reply"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RepliesList({ discussionId, strategyId }: { discussionId: string; strategyId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["community", "replies", discussionId],
    queryFn: async () => {
      const res = await fetch(`/api/community/discussions/${strategyId}/${discussionId}/reply`);
      if (!res.ok) throw new Error("Failed to load replies");
      return res.json() as Promise<{ replies: Reply[] }>;
    },
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return <p className="text-xs text-gray-500">Loading replies...</p>;
  }

  const replies = data?.replies ?? [];

  if (replies.length === 0) {
    return <p className="text-xs text-gray-500">No replies yet.</p>;
  }

  return (
    <div className="space-y-2">
      {replies.map((reply) => (
        <div key={reply.id} className="rounded bg-black/20 p-2">
          <p className="text-xs text-gray-400">{reply.body}</p>
          <p className="mt-1 text-[10px] text-gray-600">
            {reply.author_name ?? "Anonymous"} &middot; {new Date(reply.created_at).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}
