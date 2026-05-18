export const WORKSPACE_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", pathPrefix: "/dashboard" },
  { label: "Engine", href: "/portfolio/engine", pathPrefix: "/portfolio/engine" },
  { label: "Strategy Council", href: "/strategy-council", pathPrefix: "/strategy-council" },
  { label: "Marketplace", href: "/marketplace", pathPrefix: "/marketplace" },
] as const;

export function engineHref(portfolioId?: string | null): string {
  if (!portfolioId) return "/portfolio/engine";
  return `/portfolio/engine?portfolio=${encodeURIComponent(portfolioId)}`;
}

export function historyHref(portfolioId?: string | null): string {
  if (!portfolioId) return "/portfolio/history";
  return `/portfolio/history?portfolioId=${encodeURIComponent(portfolioId)}`;
}

export function isWorkspaceNavActive(pathname: string, pathPrefix: string): boolean {
  if (pathPrefix === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);
}
