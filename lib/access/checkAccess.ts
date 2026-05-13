/**
 * Route-level access helpers (middleware + API). Token-gating stub for 2027 roadmap.
 *
 * Tier limits (Core 1 portfolio, exchange sync, Watcher) are enforced in API handlers
 * via `lib/entitlements/tier-capabilities.ts` and `getActiveServiceKeysForUser`.
 */

/** Future: resolve on-chain or custodial token for `strategyId`. */
export function isTokenGated(_strategyId: string): boolean {
  return false;
}

export function checkAccess(pathname: string): { blocked: boolean; strategyId?: string } {
  const m = /^\/marketplace\/([^/]+)/.exec(pathname);
  if (m?.[1] && isTokenGated(m[1])) {
    return { blocked: true, strategyId: m[1] };
  }
  return { blocked: false };
}

/** `/marketplace` is a public teaser; authenticated Intelligence+ unlocks import/publish UI. */
export function isPublicMarketplacePath(pathname: string): boolean {
  return pathname === "/marketplace" || pathname.startsWith("/marketplace/");
}
