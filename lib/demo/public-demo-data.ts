import type { AllocationWeight, AssetClass } from "@/lib/types/database";
import { DEFAULT_TARGETS } from "@/lib/allocation/asset-class-utils";

/** Static demo allocation — illustrative drift vs default targets for marketing /demo. */
export const PUBLIC_DEMO_ALLOCATION: AllocationWeight[] = DEFAULT_TARGETS.map((t) => {
  const driftByClass: Partial<Record<AssetClass, number>> = {
    equity: 4.2,
    fixed_income: -3.1,
    alternatives: 1.8,
    cash: -2.5,
    crypto: 0.6,
  };
  const drift = driftByClass[t.asset_class] ?? 0;
  const actual_pct = Math.round((t.target_pct + drift) * 10) / 10;
  return {
    asset_class: t.asset_class,
    target_pct: t.target_pct,
    actual_pct,
    drift_pct: Math.round((actual_pct - t.target_pct) * 10) / 10,
    value_usd: 0,
  };
});

export const PUBLIC_DEMO_TOTAL_VALUE = 487_250;
export const PUBLIC_DEMO_HOLDINGS_COUNT = 14;
export const PUBLIC_DEMO_NAME = "Balanced Growth Demo";

export const PUBLIC_DEMO_FEATURES = [
  {
    title: "Interactive allocation ring",
    desc: "Tap each asset-class segment to compare actual weight vs target and see drift.",
  },
  {
    title: "Composite scoring",
    desc: "Ten configurable factors rank every holding with explainable sub-scores.",
  },
  {
    title: "Drift & signals",
    desc: "RSI and return-based Entry / Hold / Exit labels when weights move beyond threshold.",
  },
  {
    title: "Weekly AI brief",
    desc: "Portfolio-specific narrative with mandatory non-advisory disclaimer.",
  },
  {
    title: "Strategy marketplace",
    desc: "Publish, import, and rate allocation sleeves with import-token entitlements.",
  },
] as const;
