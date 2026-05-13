"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { resetPortfolioExecutionLock } from "@/lib/actions/execution/resetPortfolioExecutionLock";

type SafetyState = {
  systemStatus: string;
  haltCategory: "NONE" | "SAFETY" | "NETWORK";
  lastErrorCode: string | null;
};

export function SystemSafetyBanner({ portfolioId }: { portfolioId: string | null }) {
  const [state, setState] = useState<SafetyState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!portfolioId) {
      setState(null);
      return;
    }
    setErr(null);
    try {
      const res = await fetch(`/api/portfolio/system-safety?portfolioId=${encodeURIComponent(portfolioId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setState(null);
        return;
      }
      const j = (await res.json()) as SafetyState;
      setState(j);
    } catch {
      setState(null);
    }
  }, [portfolioId]);

  useEffect(() => {
    void load();
  }, [load]);

  const show = portfolioId && state && (state.systemStatus === "LOCKED" || state.systemStatus === "PAUSED");
  if (!show || !state) return null;

  const pid = portfolioId;
  const code = state.lastErrorCode ?? "PROTOCOL_HALT";
  const isSafety = state.systemStatus === "LOCKED" || state.haltCategory === "SAFETY";
  const isNetwork = state.systemStatus === "PAUSED" || state.haltCategory === "NETWORK";

  async function onReset() {
    setBusy(true);
    setErr(null);
    try {
      const r = await resetPortfolioExecutionLock(pid);
      if (!r.success) {
        setErr(r.error ?? "Reset failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="alert"
      className={
        isSafety
          ? "border-b border-amber-700/80 bg-gradient-to-r from-[#3f0a0a] via-[#5c1a0a] to-[#3f0a0a] px-4 py-3 text-center shadow-[0_4px_24px_rgba(0,0,0,0.45)]"
          : "border-b border-sky-800/80 bg-gradient-to-r from-[#0a1f2e] via-[#0f2f45] to-[#0a1f2e] px-4 py-3 text-center shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
      }
    >
      {isSafety ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/95">Protocol locked — safety</p>
          <p className="mt-1 font-mono text-sm text-amber-50">
            EXECUTION PROTOCOL LOCKED: Automated orders halted due to{" "}
            <span className="rounded bg-black/30 px-1.5 py-0.5 text-amber-200">{code}</span>. Execution guardrails
            triggered (hard-fail class).
          </p>
        </>
      ) : isNetwork ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/95">Protocol paused — network</p>
          <p className="mt-1 font-mono text-sm text-sky-50">
            EXECUTION PROTOCOL PAUSED: Transient or rate-limit conditions ({code}). Automated retries and Watcher
            cadence are throttled until recovery or operator reset.
          </p>
        </>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={`/portfolio/${encodeURIComponent(pid)}/execution-safety`}
          className={
            isSafety
              ? "text-xs font-medium text-amber-200 underline decoration-amber-500/60 underline-offset-4 hover:text-white"
              : "text-xs font-medium text-sky-200 underline decoration-sky-500/60 underline-offset-4 hover:text-white"
          }
        >
          Review failures (safety log)
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onReset()}
          className={
            isSafety
              ? "rounded border border-amber-400/50 bg-amber-950/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-100 transition hover:bg-amber-900/60 disabled:opacity-50"
              : "rounded border border-sky-400/50 bg-sky-950/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sky-100 transition hover:bg-sky-900/60 disabled:opacity-50"
          }
        >
          {busy ? "Resetting…" : "Reset protocol"}
        </button>
      </div>
      {err ? <p className="mt-2 text-xs text-red-300">{err}</p> : null}
    </div>
  );
}
