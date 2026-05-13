import { resolveEffectiveTier, tierMeetsMinimum, type PemabuTier } from "@/lib/security/tier-guard";

/** Exchange / venue price sync (not manual entry). Requires Intelligence+. */
export function canUseExchangePriceSync(activeServiceKeys: readonly string[]): boolean {
  return tierMeetsMinimum(resolveEffectiveTier(activeServiceKeys), "INTELLIGENCE");
}

/** Watcher agent + automated drift proposals. Requires Intelligence+. */
export function canUseWatcherAgent(activeServiceKeys: readonly string[]): boolean {
  return tierMeetsMinimum(resolveEffectiveTier(activeServiceKeys), "INTELLIGENCE");
}

/** Execution vault / trade movement. Requires Autonomous. */
export function canUseExecutionVault(activeServiceKeys: readonly string[]): boolean {
  return tierMeetsMinimum(resolveEffectiveTier(activeServiceKeys), "AUTONOMOUS");
}

export function maxPortfoliosForTier(tier: PemabuTier): number {
  if (tier === "CORE") return 1;
  if (tier === "INTELLIGENCE") return 10;
  return Number.POSITIVE_INFINITY;
}
