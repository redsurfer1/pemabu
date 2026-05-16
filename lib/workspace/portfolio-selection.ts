export const WORKSPACE_PORTFOLIO_STORAGE_KEY = "pemabu.workspace.portfolioId";

export function readStoredPortfolioId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(WORKSPACE_PORTFOLIO_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function resolveWorkspacePortfolioId(
  portfolios: Array<{ id: string }>,
  urlPortfolioId: string | null,
): string {
  if (!portfolios.length) return "";
  if (urlPortfolioId && portfolios.some((p) => p.id === urlPortfolioId)) {
    return urlPortfolioId;
  }
  const stored = readStoredPortfolioId();
  if (stored && portfolios.some((p) => p.id === stored)) return stored;
  return portfolios[0]!.id;
}
