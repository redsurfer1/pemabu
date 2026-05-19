"use client";

import { useOnboardingTour, type TourStep } from "@/hooks/useOnboardingTour";

interface OnboardingTourProps {
  steps: TourStep[];
  autoStart?: boolean;
}

export function OnboardingTour({ steps, autoStart = true }: OnboardingTourProps) {
  const { active, currentStep, current, total, completed, next, prev, skip, isLast, isFirst } =
    useOnboardingTour(steps);

  if (!active && autoStart && completed) return null;
  if (!active) return null;
  if (!current) return null;

  return (
    <>
      <div className="fixed inset-0 z-[999] bg-black/60" onClick={skip} />

      <div
        className="fixed inset-0 z-[1000] flex items-center justify-center p-6 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full max-w-md rounded-xl border border-white/10 bg-[#0A1628] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-widest text-emerald-400">
              Tour {currentStep + 1} of {total}
            </span>
            <button type="button" onClick={skip} className="text-xs text-gray-600 hover:text-gray-400">
              Skip
            </button>
          </div>

          <p className="text-sm font-medium text-white">{current.title}</p>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">{current.description}</p>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 w-4 rounded-full transition-colors ${
                    i === currentStep ? "bg-emerald-400" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Back
                </button>
              )}
              {isLast ? (
                <button
                  type="button"
                  onClick={skip}
                  className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs text-white hover:bg-emerald-400"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs text-white hover:bg-emerald-400"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function useDashboardTourSteps(): TourStep[] {
  return [
    {
      target: "",
      title: "Welcome to Pemabu",
      description:
        "Your portfolio intelligence platform. This quick tour will walk you through the key features to get you started.",
    },
    {
      target: "",
      title: "Add Holdings",
      description:
        "Use the Holdings Builder to add your portfolio holdings. You can add tickers, quantities, and cost basis manually or import from a broker.",
    },
    {
      target: "",
      title: "Monitor Signals",
      description:
        "The Signal Feed shows real-time watcher signals — drift alerts, allocation changes, and market events that affect your portfolio.",
    },
    {
      target: "",
      title: "Explore Services",
      description:
        "Access advanced features like Strategy Council memos, Macro Intelligence, DeFi tracking, Options overlays, and more from the services sidebar.",
    },
    {
      target: "",
      title: "You're all set!",
      description:
        "Start by creating or importing a portfolio. You can also click \"Create demo portfolio\" below to explore with sample data.",
    },
  ];
}
