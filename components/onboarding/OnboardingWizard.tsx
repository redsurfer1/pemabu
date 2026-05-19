"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PortfolioTypeCard } from "@/components/onboarding/PortfolioTypeCard";

interface OnboardingWizardProps {
  onComplete: () => void;
}

type WizardStep = "welcome" | "portfolio_type" | "creating" | "features" | "done";

const PORTFOLIO_TYPES = [
  {
    id: "growth",
    title: "Growth Portfolio",
    description: "Higher equity allocation with crypto exposure for maximum long-term growth potential",
    riskLabel: "High Risk",
  },
  {
    id: "balanced",
    title: "Balanced Portfolio",
    description: "60/40 mix of equities and fixed income for steady growth with moderate risk",
    riskLabel: "Moderate",
  },
  {
    id: "income",
    title: "Income Portfolio",
    description: "Dividend-focused equities with heavy bond exposure for capital preservation and income",
    riskLabel: "Low Risk",
  },
] as const;

const FEATURES = [
  {
    title: "Portfolio Engine",
    description: "Real-time allocation tracking with drift alerts and rebalancing signals",
  },
  {
    title: "Strategy Council",
    description: "Monthly AI-generated memos analyzing your portfolio performance",
  },
  {
    title: "Marketplace",
    description: "Browse and import sleeve blueprints from professional strategists",
  },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("welcome");
  const [selectedType, setSelectedType] = useState<string>("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdingsCount, setHoldingsCount] = useState<number>(0);

  async function handleCreatePortfolio() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workbook/auto-onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ portfolioType: selectedType }),
      });
      const data = (await res.json()) as { error?: string; portfolioId?: string; holdingsCount?: number };
      if (!res.ok) throw new Error(data.error ?? "Failed to create portfolio");
      if (data.holdingsCount) setHoldingsCount(data.holdingsCount);
      setStep("features");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    try {
      localStorage.setItem("pemabu.onboarding.completed", "true");
    } catch {}
    onComplete();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0D1B2A] shadow-2xl">
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Welcome to Pemabu</h2>
            <span className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
              {step === "welcome" ? "Step 1/4" : step === "portfolio_type" ? "Step 2/4" : step === "features" ? "Step 3/4" : "Step 4/4"}
            </span>
          </div>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4].map((i) => {
              const currentStepIndex = step === "welcome" ? 1 : step === "portfolio_type" ? 2 : step === "features" ? 3 : 4;
              return (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${i <= currentStepIndex ? "bg-emerald-400" : "bg-white/10"}`}
                />
              );
            })}
          </div>
        </div>

        <div className="px-6 py-6">
          {step === "welcome" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                Your portfolio intelligence platform for tracking allocations, monitoring signals, and making informed
                decisions.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Real-time tracking", sub: "Live price feeds and allocation monitoring" },
                  { label: "AI insights", sub: "Automated briefs and monthly portfolio memos" },
                  { label: "Multi-asset", sub: "Stocks, bonds, crypto, alternatives in one view" },
                  { label: "Self-hosted", sub: "Your data stays on your machine" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs font-medium text-white">{item.label}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{item.sub}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep("portfolio_type")}
                className="mt-2 w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-white hover:bg-emerald-400"
              >
                Get Started
              </button>
            </div>
          )}

          {step === "portfolio_type" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Choose a sample portfolio type to explore the platform. You can modify holdings anytime.
              </p>
              <div className="space-y-2">
                {PORTFOLIO_TYPES.map((pt) => (
                  <PortfolioTypeCard
                    key={pt.id}
                    type={pt.id}
                    selected={selectedType === pt.id}
                    onSelect={() => setSelectedType(pt.id)}
                    title={pt.title}
                    description={pt.description}
                    riskLabel={pt.riskLabel}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("welcome")}
                  className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm text-gray-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreatePortfolio()}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Sample Portfolio"}
                </button>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}

          {step === "creating" && (
            <div className="flex flex-col items-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <p className="mt-4 text-sm text-gray-400">Setting up your portfolio...</p>
            </div>
          )}

          {step === "features" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3">
                <p className="text-sm font-medium text-emerald-400">
                  Portfolio created successfully!
                </p>
                <p className="mt-1 text-xs text-emerald-400/80">
                  A sample portfolio with {holdingsCount} holdings across all asset classes is ready.
                </p>
              </div>
              <p className="text-sm text-gray-400">Here&apos;s what you can do next:</p>
              <div className="space-y-2">
                {FEATURES.map((f) => (
                  <div key={f.title} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs font-medium text-white">{f.title}</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">{f.description}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("portfolio_type")}
                  className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm text-gray-400 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="flex-1 rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-white hover:bg-emerald-400"
                >
                  Start Exploring
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-8">
              <p className="text-lg font-medium text-white">You&apos;re all set!</p>
              <p className="mt-2 text-sm text-gray-400">Start building your portfolio.</p>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 px-6 py-3">
          <button
            type="button"
            onClick={handleDone}
            className="text-xs text-gray-600 hover:text-gray-400"
          >
            Skip onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
