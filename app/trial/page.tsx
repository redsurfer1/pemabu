"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrialPage() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function startTrial() {
    setState("loading");
    try {
      const res = await fetch("/api/trial/start", { method: "POST" });
      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        code?: string;
        ends_at?: string;
      };

      if (res.ok && data.ok) {
        setState("success");
        const endsAt = data.ends_at ? new Date(data.ends_at).toLocaleDateString() : "30 days";
        setMessage(`Trial active until ${endsAt}. Redirecting…`);
        setTimeout(() => router.push("/"), 2000);
      } else if (data.code === "ALREADY_IN_GROUP") {
        setState("error");
        setMessage("You already have an active trial or subscription. Visit the upgrade page to see your options.");
      } else {
        setState("error");
        setMessage(data.error ?? "Failed to start trial. Please try again.");
      }
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#0A1628] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="text-4xl mb-4">⚡</div>
            <h1 className="text-2xl font-bold text-white">Start Your Free Trial</h1>
            <p className="text-gray-400 text-sm">
              30-day full access to Pemabu — Autonomous tier, all add-ons, no credit card required.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-gray-300">
            {[
              "Full allocation engine with Watcher Agent",
              "13F institutional overlay",
              "Political Trade Tracker",
              "Scenario Simulation (unlimited during trial)",
              "Live Broadcast",
              "Macro Intelligence + Governance Alerts",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {state === "success" && (
            <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-lg p-4 text-emerald-300 text-sm text-center">
              {message}
            </div>
          )}

          {state === "error" && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
              {message}
            </div>
          )}

          {state !== "success" && (
            <button
              onClick={() => void startTrial()}
              disabled={state === "loading"}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {state === "loading" ? (
                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : null}
              Start 30-Day Free Trial
            </button>
          )}

          <p className="text-xs text-gray-600 text-center">
            One trial per account. Converts to Core access after 30 days unless you subscribe.
          </p>
        </div>
      </div>
    </div>
  );
}
