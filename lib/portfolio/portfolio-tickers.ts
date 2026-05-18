import { supabaseAdmin } from "@/lib/supabase/admin";

const SKIP_ASSET_CLASSES = new Set(["cash"]);

/** Distinct tickers from `portfolio_holdings` for the user's portfolio(s). */
export async function getPortfolioTickersForUser(
  userId: string,
  opts?: { portfolioId?: string; assetClass?: string },
): Promise<string[]> {
  let portfolioIds: string[];

  if (opts?.portfolioId) {
    const { data: portfolio } = await supabaseAdmin
      .from("portfolios")
      .select("id")
      .eq("id", opts.portfolioId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!portfolio) return [];
    portfolioIds = [opts.portfolioId];
  } else {
    const { data: portfolios } = await supabaseAdmin
      .from("portfolios")
      .select("id")
      .eq("user_id", userId);

    portfolioIds = ((portfolios ?? []) as Array<{ id: string }>).map((p) => p.id);
  }

  if (portfolioIds.length === 0) return [];

  let query = supabaseAdmin
    .from("portfolio_holdings")
    .select("ticker, asset_class")
    .in("portfolio_id", portfolioIds);

  if (opts?.assetClass) {
    query = query.eq("asset_class", opts.assetClass);
  }

  const { data: holdings, error } = await query;
  if (error) throw error;

  const tickers = new Set<string>();
  for (const row of holdings ?? []) {
    const h = row as { ticker: string; asset_class?: string };
    if (h.asset_class && SKIP_ASSET_CLASSES.has(h.asset_class)) continue;
    const t = h.ticker?.trim().toUpperCase();
    if (t && t !== "CASH") tickers.add(t);
  }

  return [...tickers].sort();
}

export async function getCryptoTickersForUser(userId: string): Promise<string[]> {
  return getPortfolioTickersForUser(userId, { assetClass: "crypto" });
}

/** Equity / ETF / fund tickers suitable for 13F and congressional overlap. */
export async function getEquityTickersForUser(userId: string): Promise<string[]> {
  const all = await getPortfolioTickersForUser(userId);
  const crypto = new Set(await getCryptoTickersForUser(userId));
  return all.filter((t) => !crypto.has(t));
}
