"use client";

import { useDemoMode } from "@/components/demo/DemoModeProvider";

export function DemoBanner() {
  const { active, disable } = useDemoMode();

  if (!active) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
          DEMO
        </span>
        <p className="text-xs text-amber-200/80">
          Preview mode — showing mock data.{" "}
          <a href="/upgrade" className="underline hover:text-amber-100">
            Subscribe
          </a>{" "}
          for live data.
        </p>
      </div>
      <button
        type="button"
        onClick={disable}
        className="rounded border border-amber-400/20 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-400/10"
      >
        Exit demo
      </button>
    </div>
  );
}
