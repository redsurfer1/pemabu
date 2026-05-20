// lib/allocation/engine.ts — DEPRECATED
// All functions have moved to lib/allocation/asset-class-utils.ts.
// Please update imports to use "@/lib/allocation/asset-class-utils" directly.
// This file will be removed in a future cleanup pass.

export type {
  Quote,
  AllocationTarget,
  HoldingWeightRow,
  HoldingDriftRow,
} from "./asset-class-utils";

export {
  DEFAULT_TARGETS,
  DRIFT_THRESHOLD_PCT,
  calculateHoldingValue,
  calculatePortfolioValue,
  calculateAllocationWeights,
  detectDrift,
  calculateHoldingWeights,
  calculateHoldingDrift,
  buildSnapshotData,
} from "./asset-class-utils";
