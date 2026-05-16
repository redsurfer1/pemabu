"use client";

import { useState } from "react";
import { NON_FIDUCIARY_FOOTER } from "@/lib/constants/compliance";

interface PortfolioBriefPanelProps {
  portfolioId: string;
}

interface BriefResponse {
  brief: string;
  cached?: boolean;
  nextAvailableMs?: number;
  message?: string;
}

function formatCooldown(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function PortfolioBriefPanel({ portfolioId }: PortfolioBriefPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [nextAvailableMs, setNextAvailableMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workbook/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as BriefResponse;
      setBrief(data.brief);
      setCached(data.cached ?? false);
      setNextAvailableMs(data.nextAvailableMs ?? null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); void handleGenerate(); }}
        className="rounded border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
      >
        Portfolio Brief
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 overflow-y-auto border-l border-white/10 bg-[#0D1B2A] p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-[Georgia,serif] text-sm text-white">Portfolio Brief</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-gray-500 hover:text-white text-xs"
        >
          Close
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C9A84C] border-t-transparent" />
          <p className="text-xs text-gray-500">Generating brief...</p>
        </div>
      )}

      {error && !loading && (
        <div className="mb-4 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {brief && !loading && (
        <>
          {cached && nextAvailableMs != null && (
            <div className="mb-3 rounded bg-[#C9A84C]/10 px-3 py-2 text-[10px] text-[#C9A84C]">
              Showing cached brief — next refresh available in {formatCooldown(nextAvailableMs)}.
            </div>
          )}
          <div className="rounded border border-white/10 bg-white/[0.03] p-4">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-300">{brief}</p>
          </div>
          {!cached && (
            <p className="mt-3 text-[10px] text-gray-600">
              Briefs refresh once every 24 hours.
            </p>
          )}
        </>
      )}

      {!loading && !brief && !error && (
        <p className="text-xs text-gray-500">No brief generated yet.</p>
      )}

      {!loading && (brief ?? error) && (
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading || (cached && nextAvailableMs != null && nextAvailableMs > 0)}
          className="mt-4 w-full rounded border border-white/10 px-4 py-2 text-xs text-gray-400 transition-colors hover:border-[#C9A84C]/50 hover:text-[#C9A84C] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {cached ? "Cached — check back later" : "Regenerate"}
        </button>
      )}

      <p className="mt-6 border-t border-white/10 pt-4 text-[10px] leading-relaxed text-gray-500">
        {NON_FIDUCIARY_FOOTER}
      </p>
    </div>
  );
}
