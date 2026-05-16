/**
 * Token Transparency Framework (TTF) — 18 criteria scoring engine.
 * Composite score 0–100. Data sourced from CoinGecko public API (no key required).
 * Each criterion contributes a fixed weight to the composite.
 */

export interface TTFCriteria {
  // Documentation
  c1_whitepaper_exists: boolean | null;
  c2_open_source: boolean | null;
  // Security
  c3_code_audited: boolean | null;
  c4_bug_bounty_active: boolean | null;
  // Team
  c5_team_doxxed: boolean | null;
  c6_founders_disclosed: boolean | null;
  // Tokenomics
  c7_tokenomics_disclosed: boolean | null;
  c8_vesting_schedule_disclosed: boolean | null;
  c9_treasury_transparency: boolean | null;
  // Governance
  c10_governance_mechanism: boolean | null;
  c11_on_chain_governance: boolean | null;
  // Market integrity
  c12_liquidity_lock: boolean | null;
  c13_cex_listing: boolean | null;
  c14_trading_volume_consistent: boolean | null;
  // Infrastructure
  c15_oracle_usage_disclosed: boolean | null;
  c16_bridge_dependencies_disclosed: boolean | null;
  // Regulatory / compliance
  c17_regulatory_compliance_stated: boolean | null;
  c18_developer_activity: boolean | null;
}

// Weight in points (total = 100 when all are true).
const WEIGHTS: Record<keyof TTFCriteria, number> = {
  c1_whitepaper_exists: 6,
  c2_open_source: 7,
  c3_code_audited: 8,
  c4_bug_bounty_active: 5,
  c5_team_doxxed: 6,
  c6_founders_disclosed: 5,
  c7_tokenomics_disclosed: 6,
  c8_vesting_schedule_disclosed: 5,
  c9_treasury_transparency: 5,
  c10_governance_mechanism: 5,
  c11_on_chain_governance: 4,
  c12_liquidity_lock: 4,
  c13_cex_listing: 4,
  c14_trading_volume_consistent: 5,
  c15_oracle_usage_disclosed: 5,
  c16_bridge_dependencies_disclosed: 4,
  c17_regulatory_compliance_stated: 5,
  c18_developer_activity: 6,
};

export function computeCompositeScore(criteria: TTFCriteria): number {
  let score = 0;
  let totalAvailableWeight = 0;

  for (const [k, weight] of Object.entries(WEIGHTS) as Array<[keyof TTFCriteria, number]>) {
    if (criteria[k] !== null) {
      totalAvailableWeight += weight;
      if (criteria[k] === true) score += weight;
    }
  }

  if (totalAvailableWeight === 0) return 0;
  return Math.round((score / totalAvailableWeight) * 100);
}

export function computeSummaryFlags(criteria: TTFCriteria): string[] {
  const flags: string[] = [];
  if (criteria.c3_code_audited === true) flags.push("Audited");
  if (criteria.c2_open_source === true) flags.push("Open Source");
  if (criteria.c5_team_doxxed === true) flags.push("Team Verified");
  if (criteria.c10_governance_mechanism === true) flags.push("Governed");
  if (criteria.c4_bug_bounty_active === true) flags.push("Bug Bounty");
  if (criteria.c3_code_audited === false) flags.push("⚠ No Audit");
  if (criteria.c2_open_source === false) flags.push("⚠ Closed Source");
  if (criteria.c5_team_doxxed === false) flags.push("⚠ Anonymous Team");
  if (criteria.c14_trading_volume_consistent === false) flags.push("⚠ Thin Liquidity");
  return flags;
}

interface CoinGeckoData {
  id?: string;
  symbol?: string;
  links?: {
    whitepaper?: string;
    repos_url?: { github?: string[] };
    homepage?: string[];
  };
  community_data?: {
    reddit_subscribers?: number;
    twitter_followers?: number;
  };
  developer_data?: {
    code_additions_deletions_4_weeks?: {
      additions?: number;
      deletions?: number;
    };
    commit_count_4_weeks?: number;
    repos?: Array<{ language?: string }>;
  };
  market_data?: {
    total_volume?: { usd?: number };
    market_cap?: { usd?: number };
    ath?: { usd?: number };
    current_price?: { usd?: number };
  };
  tickers?: Array<{ market?: { identifier?: string } }>;
  security_score?: number;
}

// Fetch CoinGecko public data for a token ticker.
// Rate limit: 10-30 req/min on free tier.
async function fetchCoinGeckoData(ticker: string): Promise<CoinGeckoData | null> {
  // Step 1: resolve ticker to CoinGecko ID.
  const listRes = await fetch(
    `https://api.coingecko.com/api/v3/coins/list?include_platform=false`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!listRes.ok) return null;

  const list = await listRes.json() as Array<{ id: string; symbol: string; name: string }>;
  const match = list.find((c) => c.symbol.toLowerCase() === ticker.toLowerCase());
  if (!match) return null;

  // Step 2: fetch coin detail.
  const detailRes = await fetch(
    `https://api.coingecko.com/api/v3/coins/${match.id}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!detailRes.ok) return null;
  return detailRes.json() as Promise<CoinGeckoData>;
}

export interface TTFScoreResult {
  ticker: string;
  composite_score: number;
  criteria: TTFCriteria;
  summary_flags: string[];
  sources: Record<string, unknown>;
}

export async function scoreTicker(ticker: string): Promise<TTFScoreResult> {
  const data = await fetchCoinGeckoData(ticker);

  // Derive criteria from CoinGecko fields.
  const repos = data?.links?.repos_url?.github ?? [];
  const hasRepo = repos.length > 0 && repos.some((r) => r.length > 0);
  const hasWhitepaper = !!(data?.links?.whitepaper && data.links.whitepaper.length > 0);
  const commitCount = data?.developer_data?.commit_count_4_weeks ?? 0;
  const cexTickers = (data?.tickers ?? []).filter(
    (t) => ["binance", "coinbase", "kraken", "kucoin", "okex"].includes(t.market?.identifier ?? ""),
  );
  const volume24h = data?.market_data?.total_volume?.usd ?? 0;
  const marketCap = data?.market_data?.market_cap?.usd ?? 0;

  const criteria: TTFCriteria = {
    c1_whitepaper_exists: data ? hasWhitepaper : null,
    c2_open_source: data ? hasRepo : null,
    c3_code_audited: null, // Not derivable from CoinGecko — would need audit DB
    c4_bug_bounty_active: null, // Not derivable from CoinGecko
    c5_team_doxxed: null, // Not derivable from CoinGecko
    c6_founders_disclosed: null,
    c7_tokenomics_disclosed: data ? hasWhitepaper : null, // Proxy: whitepaper often includes tokenomics
    c8_vesting_schedule_disclosed: null,
    c9_treasury_transparency: null,
    c10_governance_mechanism: null,
    c11_on_chain_governance: null,
    c12_liquidity_lock: null,
    c13_cex_listing: data ? cexTickers.length > 0 : null,
    c14_trading_volume_consistent: data ? (volume24h > 1_000_000 && marketCap > 0) : null,
    c15_oracle_usage_disclosed: null,
    c16_bridge_dependencies_disclosed: null,
    c17_regulatory_compliance_stated: null,
    c18_developer_activity: data ? commitCount > 0 : null,
  };

  const composite_score = computeCompositeScore(criteria);
  const summary_flags = computeSummaryFlags(criteria);

  return {
    ticker: ticker.toUpperCase(),
    composite_score,
    criteria,
    summary_flags,
    sources: {
      coingecko_id: data?.id ?? null,
      coingecko_symbol: data?.symbol ?? null,
      data_available: data !== null,
    },
  };
}
