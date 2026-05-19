"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";

interface MorningBriefCardProps {
  portfolioId: string;
  portfolioName: string;
}

interface BriefData {
  brief: string;
  cached?: boolean;
  nextAvailableMs?: number;
  generatedAt?: string;
}

async function fetchLatestBrief(portfolioId: string): Promise<BriefData | null> {
  const res = await fetch(`/api/workbook/brief?portfolioId=${encodeURIComponent(portfolioId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch brief");
  return res.json() as Promise<BriefData>;
}

async function generateBrief(portfolioId: string): Promise<BriefData> {
  const res = await fetch("/api/workbook/brief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portfolioId }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<BriefData>;
}

export function MorningBriefCard({ portfolioId, portfolioName }: MorningBriefCardProps) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["morning-brief", portfolioId],
    queryFn: () => fetchLatestBrief(portfolioId),
    staleTime: 5 * 60 * 1000,
  });

  const genMutation = useMutation({
    mutationFn: () => generateBrief(portfolioId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["morning-brief", portfolioId] });
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-400">Morning Brief</p>
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
        </div>
        <p className="mt-2 text-xs text-gray-600">Loading latest brief...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/10 bg-red-400/5 p-4">
        <p className="text-xs font-medium text-gray-400">Morning Brief</p>
        <p className="mt-1 text-xs text-red-400">Failed to load brief</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-400">Morning Brief</p>
          {data?.cached && (
            <span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] text-emerald-400">Today&apos;s</span>
          )}
        </div>
        <div className="flex gap-2">
          {data?.generatedAt && (
            <span className="text-[10px] text-gray-600">
              {new Date(data.generatedAt).toLocaleDateString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-white"
          >
            {expanded ? "Hide" : "View"}
          </button>
        </div>
      </div>

      <p className="mt-1 text-xs text-gray-500 line-clamp-1">{portfolioName}</p>

      {expanded && (
        <div className="mt-3 space-y-3">
          {data?.brief ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-300">{data.brief}</p>
            </div>
          ) : (
            <EmptyState title="No brief generated yet" description="Generate your first morning brief to get started" />
          )}

          <button
            type="button"
            onClick={() => genMutation.mutate()}
            disabled={genMutation.isPending}
            className="w-full rounded border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
          >
            {genMutation.isPending ? "Generating..." : data?.brief ? "Regenerate Brief" : "Generate Brief"}
          </button>

          {genMutation.error && (
            <p className="text-xs text-red-400">{(genMutation.error as Error).message}</p>
          )}
        </div>
      )}
    </div>
  );
}
