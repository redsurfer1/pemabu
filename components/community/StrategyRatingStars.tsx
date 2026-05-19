"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/constants/query-config";

type Props = {
  strategyId: string;
  initialAverage?: number;
  initialCount?: number;
  readonly?: boolean;
};

export function StrategyRatingStars({ strategyId, readonly = false }: Props) {
  const qc = useQueryClient();

  const { data: ratingData } = useQuery({
    queryKey: ["community", "ratings", strategyId],
    queryFn: async () => {
      const res = await fetch(`/api/community/ratings/${strategyId}`);
      if (!res.ok) throw new Error("Failed to load rating");
      return res.json() as Promise<{ average: number; count: number; userRating: number | null }>;
    },
    staleTime: STALE.LEADERBOARD,
  });

  const rateMutation = useMutation({
    mutationFn: async (rating: number) => {
      const res = await fetch(`/api/community/ratings/${strategyId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to rate" }));
        throw new Error(err.error ?? "Failed to rate");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community", "ratings", strategyId] });
    },
  });

  const average = ratingData?.average ?? 0;
  const count = ratingData?.count ?? 0;
  const userRating = ratingData?.userRating ?? null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= (readonly ? Math.round(average) : (userRating ?? 0));
          return (
            <button
              key={star}
              type="button"
              disabled={readonly || rateMutation.isPending}
              onClick={() => rateMutation.mutate(star)}
              className={`text-lg leading-none transition-colors ${
                readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
              } ${filled ? "text-yellow-400" : "text-gray-600"}`}
              title={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              {filled ? "\u2605" : "\u2606"}
            </button>
          );
        })}
        {count > 0 ? (
          <span className="ml-1 text-xs text-gray-500">
            {average.toFixed(1)} \u2605 ({count} rating{count !== 1 ? "s" : ""})
          </span>
        ) : (
          <span className="ml-1 text-xs text-gray-500">No ratings yet</span>
        )}
      </div>
      {rateMutation.isError && (
        <p className="text-[11px] text-red-400">{(rateMutation.error as Error).message}</p>
      )}
    </div>
  );
}
