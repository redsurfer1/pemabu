"use client";

import { useEffect } from "react";
import { useOnboardingTour, type TourStep } from "@/hooks/useOnboardingTour";

interface OnboardingTourProps {
  steps: TourStep[];
  autoStart?: boolean;
}

export function OnboardingTour({ steps, autoStart = false }: OnboardingTourProps) {
  const { active, currentStep, current, total, completed, start, next, prev, skip, isLast, isFirst } =
    useOnboardingTour(steps);

  useEffect(() => {
    if (autoStart && !completed) {
      start();
    }
  }, [autoStart, completed, start]);

  if (completed && !active) return null;
  if (!active || !current) return null;

  return (
    <>
      <div className="fixed inset-0 z-[999] bg-black/60" onClick={skip} aria-hidden />

      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 pointer-events-none">
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
              {!isFirst ? (
                <button
                  type="button"
                  onClick={prev}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                >
                  Back
                </button>
              ) : null}
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
      target: "#dashboard-portfolios",
      title: "Welcome to Pemabu",
      description:
        "Your portfolio intelligence platform. Select a portfolio here to work across holdings, signals, and services.",
    },
    {
      target: "#dashboard-holdings",
      title: "Add Holdings",
      description:
        "Use the Holdings Builder to add tickers, quantities, and cost basis — or import from a broker export.",
    },
    {
      target: "#dashboard-signals",
      title: "Monitor Signals",
      description:
        "The Signal Feed shows drift alerts, allocation changes, and watcher events for the selected portfolio.",
    },
    {
      target: "#dashboard-services-sidebar",
      title: "Explore Services",
      description:
        "Open Strategy Council, Macro Intelligence, DeFi, Options, and the marketplace from the services sidebar.",
    },
    {
      target: "",
      title: "You're all set!",
      description:
        "Publish strategies on the marketplace or run a scenario simulation when you're ready to go deeper.",
    },
  ];
}
