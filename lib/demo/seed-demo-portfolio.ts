import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssetClass } from "@/lib/types/database";

export const DEMO_PORTFOLIO_NAME = "Pemabu Demo Portfolio";

export type PortfolioType = "growth" | "balanced" | "income";

type DemoHoldingSeed = {
  ticker: string;
  name: string;
  asset_class: AssetClass;
  quantity: number;
  current_price: number;
  expense_ratio?: number;
};

const GROWTH_HOLDINGS: DemoHoldingSeed[] = [
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", asset_class: "equity", quantity: 520, current_price: 268.5, expense_ratio: 0.0003 },
  { ticker: "VXUS", name: "Vanguard Total International Stock ETF", asset_class: "equity", quantity: 200, current_price: 62.4, expense_ratio: 0.0007 },
  { ticker: "QQQ", name: "Invesco QQQ Trust", asset_class: "equity", quantity: 85, current_price: 485.3, expense_ratio: 0.002 },
  { ticker: "VUG", name: "Vanguard Growth ETF", asset_class: "equity", quantity: 150, current_price: 362.1, expense_ratio: 0.0004 },
  { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", asset_class: "equity", quantity: 100, current_price: 82.3, expense_ratio: 0.0006 },
  { ticker: "IEMG", name: "iShares Core MSCI Emerging Markets ETF", asset_class: "equity", quantity: 180, current_price: 52.8, expense_ratio: 0.0009 },
  { ticker: "IBIT", name: "iShares Bitcoin Trust", asset_class: "crypto", quantity: 25, current_price: 58.2, expense_ratio: 0.0025 },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", asset_class: "fixed_income", quantity: 150, current_price: 72.1, expense_ratio: 0.0003 },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF", asset_class: "alternatives", quantity: 60, current_price: 88.6, expense_ratio: 0.0012 },
  { ticker: "CASH", name: "Cash & Equivalents", asset_class: "cash", quantity: 25_000, current_price: 1, expense_ratio: 0 },
];

const BALANCED_HOLDINGS: DemoHoldingSeed[] = [
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", asset_class: "equity", quantity: 420, current_price: 268.5, expense_ratio: 0.0003 },
  { ticker: "VXUS", name: "Vanguard Total International Stock ETF", asset_class: "equity", quantity: 180, current_price: 62.4, expense_ratio: 0.0007 },
  { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", asset_class: "equity", quantity: 150, current_price: 82.3, expense_ratio: 0.0006 },
  { ticker: "IEMG", name: "iShares Core MSCI Emerging Markets ETF", asset_class: "equity", quantity: 120, current_price: 52.8, expense_ratio: 0.0009 },
  { ticker: "QUAL", name: "iShares MSCI USA Quality Factor ETF", asset_class: "equity", quantity: 88, current_price: 178.2, expense_ratio: 0.0015 },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", asset_class: "fixed_income", quantity: 520, current_price: 72.1, expense_ratio: 0.0003 },
  { ticker: "AGG", name: "iShares Core US Aggregate Bond ETF", asset_class: "fixed_income", quantity: 140, current_price: 98.2, expense_ratio: 0.0003 },
  { ticker: "TIP", name: "iShares TIPS Bond ETF", asset_class: "fixed_income", quantity: 75, current_price: 108.5, expense_ratio: 0.0005 },
  { ticker: "GLD", name: "SPDR Gold Shares", asset_class: "alternatives", quantity: 45, current_price: 228.4, expense_ratio: 0.004 },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF", asset_class: "alternatives", quantity: 60, current_price: 88.6, expense_ratio: 0.0012 },
  { ticker: "IBIT", name: "iShares Bitcoin Trust", asset_class: "crypto", quantity: 8, current_price: 58.2, expense_ratio: 0.0025 },
  { ticker: "CASH", name: "Cash & Equivalents", asset_class: "cash", quantity: 42_000, current_price: 1, expense_ratio: 0 },
];

const INCOME_HOLDINGS: DemoHoldingSeed[] = [
  { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", asset_class: "equity", quantity: 350, current_price: 82.3, expense_ratio: 0.0006 },
  { ticker: "VYM", name: "Vanguard High Dividend Yield ETF", asset_class: "equity", quantity: 200, current_price: 121.5, expense_ratio: 0.0006 },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", asset_class: "equity", quantity: 150, current_price: 268.5, expense_ratio: 0.0003 },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", asset_class: "fixed_income", quantity: 700, current_price: 72.1, expense_ratio: 0.0003 },
  { ticker: "AGG", name: "iShares Core US Aggregate Bond ETF", asset_class: "fixed_income", quantity: 300, current_price: 98.2, expense_ratio: 0.0003 },
  { ticker: "TIP", name: "iShares TIPS Bond ETF", asset_class: "fixed_income", quantity: 120, current_price: 108.5, expense_ratio: 0.0005 },
  { ticker: "JNK", name: "SPDR Bloomberg High Yield Bond ETF", asset_class: "fixed_income", quantity: 200, current_price: 94.8, expense_ratio: 0.004 },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF", asset_class: "alternatives", quantity: 100, current_price: 88.6, expense_ratio: 0.0012 },
  { ticker: "GLD", name: "SPDR Gold Shares", asset_class: "alternatives", quantity: 30, current_price: 228.4, expense_ratio: 0.004 },
  { ticker: "CASH", name: "Cash & Equivalents", asset_class: "cash", quantity: 60_000, current_price: 1, expense_ratio: 0 },
];

const HOLDINGS_MAP: Record<PortfolioType, DemoHoldingSeed[]> = {
  growth: GROWTH_HOLDINGS,
  balanced: BALANCED_HOLDINGS,
  income: INCOME_HOLDINGS,
};

export type SeedDemoResult =
  | { ok: true; portfolioId: string; holdingsCount: number; created: boolean }
  | { ok: false; error: string };

export async function seedDemoPortfolioForUser(
  userId: string,
  portfolioType: PortfolioType = "balanced",
): Promise<SeedDemoResult> {
  const { data: existing } = await supabaseAdmin
    .from("portfolios")
    .select("id")
    .eq("user_id", userId)
    .eq("name", DEMO_PORTFOLIO_NAME)
    .maybeSingle();

  let portfolioId: string;
  let created = false;

  if (existing?.id) {
    portfolioId = existing.id;
  } else {
    const { data: portfolio, error: pErr } = await supabaseAdmin
      .from("portfolios")
      .insert({
        user_id: userId,
        name: DEMO_PORTFOLIO_NAME,
        description: "Sample allocation portfolio — edit holdings or refresh prices anytime.",
        currency: "USD",
      })
      .select("id")
      .single();

    if (pErr || !portfolio) {
      return { ok: false, error: pErr?.message ?? "Failed to create demo portfolio" };
    }
    portfolioId = portfolio.id;
    created = true;
  }

  const holdings = HOLDINGS_MAP[portfolioType];

  const rows = holdings.map((h) => ({
    portfolio_id: portfolioId,
    ticker: h.ticker,
    name: h.name,
    asset_class: h.asset_class,
    quantity: h.quantity,
    current_price: h.current_price,
    cost_basis: h.current_price,
    currency: "USD",
    source: "manual" as const,
    expense_ratio: h.expense_ratio ?? null,
    row_status: "Active" as const,
    last_price_refreshed_at: new Date().toISOString(),
  }));

  const { error: hErr } = await supabaseAdmin
    .from("portfolio_holdings")
    .upsert(rows, { onConflict: "portfolio_id,ticker" });

  if (hErr) {
    return { ok: false, error: hErr.message };
  }

  return { ok: true, portfolioId, holdingsCount: rows.length, created };
}
