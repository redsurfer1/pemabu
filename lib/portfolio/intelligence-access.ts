import {
  resolveEffectiveTier,
  tierForbiddenResponse,
  tierMeetsMinimum,
} from "@/lib/security/tier-guard";

export type { PemabuTier } from "@/lib/security/tier-guard";
/**
 * Tier-based intelligence / watcher gates (Sovereign product matrix).
 * - Core: no Watcher, no multi-account consolidation, no morning-brief context API.
 * - Intelligence: Watcher + morning brief context + multi-account.
 * - Autonomous: 13F overlay + execution endpoints (Watcher already included).
 */

export function canAccessWatcher(activeServiceKeys: readonly string[]): boolean {
  const t = resolveEffectiveTier(activeServiceKeys);
  return tierMeetsMinimum(t, "INTELLIGENCE");
}

export function canGenerateMorningBriefContext(activeServiceKeys: readonly string[]): boolean {
  return canAccessWatcher(activeServiceKeys);
}

/** 13F / institutional overlays — Autonomous tier only. */
export function canAccess13FOverlay(activeServiceKeys: readonly string[]): boolean {
  const t = resolveEffectiveTier(activeServiceKeys);
  return tierMeetsMinimum(t, "AUTONOMOUS");
}

export function canConsolidateMultiPortfolio(activeServiceKeys: readonly string[]): boolean {
  const t = resolveEffectiveTier(activeServiceKeys);
  return tierMeetsMinimum(t, "INTELLIGENCE");
}

export function canAccessExecutionEndpoints(activeServiceKeys: readonly string[]): boolean {
  const t = resolveEffectiveTier(activeServiceKeys);
  return tierMeetsMinimum(t, "AUTONOMOUS");
}

/** Alias for execution / vault / system-safety guards. */
export function isAutonomous(activeServiceKeys: readonly string[]): boolean {
  return canAccessExecutionEndpoints(activeServiceKeys);
}

export function requireIntelligenceTier(activeServiceKeys: readonly string[]) {
  const t = resolveEffectiveTier(activeServiceKeys);
  if (tierMeetsMinimum(t, "INTELLIGENCE")) return null;
  return tierForbiddenResponse("INTELLIGENCE");
}

export function requireAutonomousTier(activeServiceKeys: readonly string[]) {
  const t = resolveEffectiveTier(activeServiceKeys);
  if (tierMeetsMinimum(t, "AUTONOMOUS")) return null;
  return tierForbiddenResponse("AUTONOMOUS");
}
