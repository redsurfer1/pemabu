/** Client-safe types and constants for portfolio API credentials (no Node crypto). */

export const PORTFOLIO_API_PROVIDERS = [
  "tiingo",
  "alpaca",
  "kraken",
  "coinbase_advanced",
] as const;

export type PortfolioApiProvider = (typeof PORTFOLIO_API_PROVIDERS)[number];

export const PORTFOLIO_API_PROVIDER_LABELS: Record<PortfolioApiProvider, string> = {
  tiingo: "Tiingo (market data)",
  alpaca: "Alpaca (execution)",
  kraken: "Kraken (execution)",
  coinbase_advanced: "Coinbase Advanced (execution)",
};

export type PortfolioApiCredentialSummary = {
  provider: PortfolioApiProvider;
  apiKeyMasked: string;
  hasSecret: boolean;
  updatedAt: string;
};

export function isPortfolioApiProvider(value: string): value is PortfolioApiProvider {
  return (PORTFOLIO_API_PROVIDERS as readonly string[]).includes(value);
}

export function providerRequiresSecret(provider: PortfolioApiProvider): boolean {
  return provider !== "tiingo";
}

/** Execution venues — must persist only in local vault, never Supabase cloud. */
export function isExecutionPortfolioProvider(provider: PortfolioApiProvider): boolean {
  return provider !== "tiingo";
}

export function exchangeNameFromProvider(
  provider: PortfolioApiProvider,
): "alpaca" | "kraken" | "coinbase_advanced" | null {
  if (provider === "tiingo") return null;
  return provider;
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}
