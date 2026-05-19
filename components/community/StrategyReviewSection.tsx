"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";

type Review = {
  id: string;
  strategy_id: string;
  user_id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  reviewer_name: string | null;
  is_own: boolean;
};

type Props = {
  strategyId: string;
};

export function StrategyReviewSection({ strategyId }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["community", "reviews", strategyId],
    queryFn: async () => {
      const res = await fetch(`/api/community/reviews/${strategyId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reviews");
      return res.json() as Promise<{ reviews: Review[] }>;
    },
    staleTime: STALE.LEADERBOARD,
  });

  const reviews = data?.reviews ?? [];

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/community/reviews/${strategyId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, rating }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to submit" }));
        throw new Error(err.error ?? "Failed to submit review");
      }
      return res.json();
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      setRating(5);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["community", "reviews", strategyId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const res = await fetch(`/api/community/reviews/${strategyId}/${reviewId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", "reviews", strategyId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-gray-300">
            {reviews.length > 0
              ? `${avgRating.toFixed(1)} \u2605 average (${reviews.length} review${reviews.length !== 1 ? "s" : ""})`
              : "No reviews yet"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded border border-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/5"
        >
          {showForm ? "Cancel" : "Write review"}
        </button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Rating:</span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                className={`text-lg ${s <= rating ? "text-yellow-400" : "text-gray-600"}`}
              >
                {s <= rating ? "\u2605" : "\u2606"}
              </button>
            ))}
          </div>
          <input
            className="w-full rounded border border-white/10 bg-[#0d1524] px-3 py-2 text-sm text-white"
            placeholder="Review title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <textarea
            className="h-24 w-full rounded border border-white/10 bg-[#0d1524] p-3 text-sm text-white"
            placeholder="Write your review..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
          />
          <button
            type="button"
            disabled={submitMutation.isPending || !title.trim() || !body.trim()}
            onClick={() => submitMutation.mutate()}
            className="rounded border border-sky-500/40 bg-sky-950/30 px-4 py-1 text-xs text-sky-100 hover:bg-sky-950/50 disabled:opacity-40"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit review"}
          </button>
          {submitMutation.isError && (
            <p className="text-xs text-red-400">{(submitMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-500">Loading reviews...</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded border border-white/5 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={s <= review.rating ? "text-yellow-400" : "text-gray-700"}>
                        {s <= review.rating ? "\u2605" : "\u2606"}
                      </span>
                    ))}
                  </span>
                  <span className="text-sm font-medium text-white">{review.title}</span>
                </div>
                {review.is_own && (
                  <button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(review.id)}
                    className="text-[11px] text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">{review.body}</p>
              <div className="mt-2 text-[10px] text-gray-600">
                {review.reviewer_name ?? "Anonymous"} &middot; {new Date(review.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
