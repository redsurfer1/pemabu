import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  colAA,
  colAB,
  colAC,
  colAD,
  colAL,
  colAM,
  colAR,
  colAS,
  colAT,
  colAU,
  colD,
  colH,
  colJ,
  colO,
  colP,
  colV,
  colW,
  colX,
  colY,
  colZ,
  computePortfolioRanks,
  computeRSI,
  denseRank,
  DEFAULT_ASSUMPTIONS,
} from "@/lib/portfolio/formula-engine";
import { getPortfolioTiingoToken } from "@/lib/portfolio/api-credentials";
import { parseRowStatus, ROW_STATUS } from "@/lib/portfolio/fiat-watchlist";
import { clearPriceCache, fetchMarketDataCached } from "@/lib/market-data/fetch-market-data";

type RefreshRow = {
  id: string;
  portfolio_id: string;
  ticker: string;
  name: string | null;
  asset_class: string;
  currency: string;
  source: string;
  quantity: number;
  expense_ratio: number | null;
  dividend_dollars: number | null;
  target_parity_weight: number | null;
  score_thirteen_f: number | null;
  score_macro_intelligence: number | null;
  score_governance_layer: number | null;
  score_political_tracker: number | null;
  score_token_quality: number | null;
  row_status: string | null;
};

type RankedWorkRow = {
  id: string;
  rowStatus: string;
  ticker: string;
  quantity: number;
  marketDataError?: boolean;
  expenseRatio: number | null;
  divApy: number | null;
  currentWeight: number | null;
  returnWeightedAvg: number | null;
  volatilityAbs: number | null;
  volatilitySigned: number | null;
  thirteenFScore?: number | null;
  macroIntelligenceScore?: number | null;
  governanceLayerScore?: number | null;
  politicalTrackerScore?: number | null;
  tokenQualityScore?: number | null;
  subRankCurrent?: number | null;
  subRankExpense?: number | null;
  subRankWeightedRet?: number | null;
  subRankDivApy?: number | null;
  subRankVolatility?: number | null;
  subRankThirteenF?: number | null;
  subRankMacroIntelligence?: number | null;
  subRankGovernanceLayer?: number | null;
  subRankPoliticalTracker?: number | null;
  subRankTokenQuality?: number | null;
  subRankVolSigned?: number | null;
  compositeScore?: number | null;
  market_value: number | null;
  return_3mo: number | null;
  return_6mo: number | null;
  return_1yr: number | null;
  return_3yr: number | null;
  return_5yr: number | null;
  return_avg: number | null;
  rsi_14: number | null;
};

export async function refreshPortfolioSignals(
  portfolioId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: rows, error: holdingsErr } = await supabase
    .from("portfolio_holdings")
    .select(
      "id,portfolio_id,ticker,name,asset_class,currency,source,quantity,expense_ratio,dividend_dollars,target_parity_weight,score_thirteen_f,score_macro_intelligence,score_governance_layer,score_political_tracker,score_token_quality,row_status",
    )
    .eq("portfolio_id", portfolioId)
    .order("ticker", { ascending: true });
  if (holdingsErr) throw holdingsErr;
  const holdings = ((rows ?? []) as RefreshRow[])
    .map((h) => ({
      ...h,
      ticker: String(h.ticker ?? "").trim().toUpperCase(),
      quantity: Number(h.quantity),
      asset_class: h.asset_class ?? "equity",
      currency: h.currency ?? "USD",
      source: h.source ?? "manual",
    }))
    .filter((h) => h.ticker.length > 0);
  if (holdings.length === 0) return;

  clearPriceCache();

  const { getPortfolioAssumptions } = await import("@/lib/portfolio/portfolio-assumptions-store");
  const assumptions = (await getPortfolioAssumptions(portfolioId)) ?? DEFAULT_ASSUMPTIONS;

  const { getPortfolioTiingoToken } = await import("@/lib/portfolio/api-credentials");
  const tiingoToken = await getPortfolioTiingoToken(supabase, portfolioId);

  const nonCashHoldings = holdings.filter((h) => h.ticker !== "CASH");
  const market = await Promise.all(
    nonCashHoldings.map((h) => fetchMarketDataCached(h.ticker, { tiingoToken })),
  );
  const marketByTicker = new Map(market.map((m) => [m.ticker, m]));

  if (holdings.some((h) => h.ticker === "CASH")) {
    marketByTicker.set("CASH", {
      ticker: "CASH",
      name: "Cash",
      price1: 1.00,
      price2: 1.00,
      price3: 1.00,
      basisPrice3mo: 1.00,
      basisPrice6mo: 1.00,
      basisPrice1yr: 1.00,
      basisPrice3yr: 1.00,
      basisPrice5yr: 1.00,
      recentCloses: Array(40).fill(1.00) as number[],
      volatility3mo: 0,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
      provider: "tiingo",
    });
  }

  const withBase = holdings.map((h) => {
    const storedStatus = parseRowStatus(h.row_status);
    const md = marketByTicker.get(h.ticker) ?? null;
    const marketDataError = Boolean(md?.error);
    if (marketDataError && storedStatus !== ROW_STATUS.WATCH) {
      return {
        id: h.id,
        ticker: h.ticker,
        name: h.name,
        asset_class: h.asset_class,
        currency: h.currency,
        source: h.source,
        rowStatus: ROW_STATUS.COMPARABLE,
        marketDataError: true,
        quantity: Number(h.quantity),
        expenseRatio: h.expense_ratio != null ? Number(h.expense_ratio) : null,
        divApy: null,
        currentWeight: null as number | null,
        returnWeightedAvg: null as number | null,
        volatilityAbs: null as number | null,
        volatilitySigned: null as number | null,
        market_value: null as number | null,
        price_current: null as number | null,
        price_24h_basis: null as number | null,
        price_7d_basis: null as number | null,
        basis_price_3mo: null as number | null,
        basis_price_6mo: null as number | null,
        basis_price_1yr: null as number | null,
        basis_price_3yr: null as number | null,
        basis_price_5yr: null as number | null,
        volatility_3mo: null as number | null,
        rsi_14: null as number | null,
        change_24h: null as number | null,
        change_7d: null as number | null,
        return_3mo: null as number | null,
        return_6mo: null as number | null,
        return_1yr: null as number | null,
        return_3yr: null as number | null,
        return_5yr: null as number | null,
        return_avg: null as number | null,
        return_weighted_avg: null as number | null,
        volatility_abs: null as number | null,
        volatility_signed: null as number | null,
        target_parity_weight: h.target_parity_weight != null ? Number(h.target_parity_weight) : null,
        target_sleeve_pct: null as number | null,
        parity_dollars: null as number | null,
        parity_change_dollars: null as number | null,
        shares_delta: null as number | null,
        alert_primary: null as string | null,
        alert_secondary: null as string | null,
        rank_overall: null as number | null,
        composite_score: null as number | null,
        sub_rank_current: null as number | null,
        sub_rank_expense: null as number | null,
        sub_rank_weighted_ret: null as number | null,
        sub_rank_div_apy: null as number | null,
        sub_rank_volatility: null as number | null,
        sub_rank_thirteen_f: null as number | null,
        sub_rank_macro_intelligence: null as number | null,
        sub_rank_governance_layer: null as number | null,
        sub_rank_political_tracker: null as number | null,
        sub_rank_token_quality: null as number | null,
        sub_rank_vol_signed: null as number | null,
      };
    }
    const price1 = md?.price1 ?? 0;
    const price2 = md?.price2 ?? 0;
    const price3 = md?.price3 ?? 0;
    const market_value = colJ(Number(h.quantity), price1);
    const divApy = colH(Number(h.dividend_dollars ?? 0), market_value);
    const return_3mo = colV(price1, md?.basisPrice3mo ?? 0);
    const return_6mo = colW(price1, md?.basisPrice6mo ?? 0);
    const return_1yr = colX(price1, md?.basisPrice1yr ?? 0);
    const return_3yr = colY(price1, md?.basisPrice3yr ?? 0);
    const return_5yr = colZ(price1, md?.basisPrice5yr ?? 0);
    const return_avg = colAA([return_3mo, return_6mo, return_1yr, return_3yr, return_5yr]);
    const return_weighted_avg = colAB(
      return_3mo,
      return_6mo,
      return_1yr,
      return_3yr,
      return_5yr,
      assumptions.return_weights,
    );
    const volatilityAbs = colAC(return_3mo);
    const volatilitySigned = colAD(return_3mo);
    const rsi = computeRSI(md?.recentCloses ?? []);
    const rowStatus =
      storedStatus === ROW_STATUS.WATCH
        ? ROW_STATUS.WATCH
        : ROW_STATUS.ACTIVE;

    return {
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      asset_class: h.asset_class,
      currency: h.currency,
      source: h.source,
      rowStatus,
      marketDataError: false,
      quantity: Number(h.quantity),
      expenseRatio: h.expense_ratio != null ? Number(h.expense_ratio) : null,
      divApy,
      currentWeight: null as number | null,
      returnWeightedAvg: return_weighted_avg,
      volatilityAbs,
      volatilitySigned,
      thirteenFScore: h.score_thirteen_f != null ? Number(h.score_thirteen_f) : null,
      macroIntelligenceScore:
        h.score_macro_intelligence != null ? Number(h.score_macro_intelligence) : null,
      governanceLayerScore:
        h.score_governance_layer != null ? Number(h.score_governance_layer) : null,
      politicalTrackerScore:
        h.score_political_tracker != null ? Number(h.score_political_tracker) : null,
      tokenQualityScore: h.score_token_quality != null ? Number(h.score_token_quality) : null,
      market_value,
      price_current: price1,
      price_24h_basis: price2,
      price_7d_basis: price3,
      basis_price_3mo: md?.basisPrice3mo ?? null,
      basis_price_6mo: md?.basisPrice6mo ?? null,
      basis_price_1yr: md?.basisPrice1yr ?? null,
      basis_price_3yr: md?.basisPrice3yr ?? null,
      basis_price_5yr: md?.basisPrice5yr ?? null,
      volatility_3mo: md?.volatility3mo ?? null,
      rsi_14: rsi,
      change_24h: colO(price1, price2),
      change_7d: colP(price1, price3),
      return_3mo,
      return_6mo,
      return_1yr,
      return_3yr,
      return_5yr,
      return_avg,
      return_weighted_avg,
      volatility_abs: volatilityAbs,
      volatility_signed: volatilitySigned,
      target_parity_weight: h.target_parity_weight != null ? Number(h.target_parity_weight) : null,
      target_sleeve_pct: null as number | null,
      parity_dollars: null as number | null,
      parity_change_dollars: null as number | null,
      shares_delta: null as number | null,
      alert_primary: null as string | null,
      alert_secondary: null as string | null,
      rank_overall: null as number | null,
      composite_score: null as number | null,
      sub_rank_current: null as number | null,
      sub_rank_expense: null as number | null,
      sub_rank_weighted_ret: null as number | null,
      sub_rank_div_apy: null as number | null,
      sub_rank_volatility: null as number | null,
      sub_rank_thirteen_f: null as number | null,
      sub_rank_macro_intelligence: null as number | null,
      sub_rank_governance_layer: null as number | null,
      sub_rank_political_tracker: null as number | null,
      sub_rank_token_quality: null as number | null,
      sub_rank_vol_signed: null as number | null,
    };
  });

  const totalMV = withBase.reduce(
    (s, r) =>
      r.rowStatus === ROW_STATUS.WATCH ? s : s + (r.market_value ?? 0),
    0,
  );
  for (const row of withBase) {
    row.currentWeight = row.market_value != null ? colD(row.market_value, totalMV) : null;
  }

  const ranked = computePortfolioRanks(
    withBase as unknown as RankedWorkRow[],
    assumptions,
  ) as unknown as Array<typeof withBase[number] & RankedWorkRow>;

  const rankMap = denseRank(ranked.map((r) => r.compositeScore ?? null), false);
  for (const row of ranked) {
    if (row.rowStatus === ROW_STATUS.WATCH) {
      row.rank_overall = null;
      row.alert_primary = null;
      row.alert_secondary = null;
      row.target_sleeve_pct = null;
      row.parity_dollars = null;
      row.parity_change_dollars = null;
      row.shares_delta = null;
      row.composite_score = null;
      row.sub_rank_current = null;
      row.sub_rank_expense = null;
      row.sub_rank_weighted_ret = null;
      row.sub_rank_div_apy = null;
      row.sub_rank_volatility = null;
      row.sub_rank_thirteen_f = null;
      row.sub_rank_macro_intelligence = null;
      row.sub_rank_governance_layer = null;
      row.sub_rank_political_tracker = null;
      row.sub_rank_token_quality = null;
      row.sub_rank_vol_signed = null;
      continue;
    }
    if (row.marketDataError) {
      row.rank_overall = null;
      row.alert_primary = null;
      row.alert_secondary = null;
      row.target_sleeve_pct = null;
      row.parity_dollars = null;
      row.parity_change_dollars = null;
      row.shares_delta = null;
      row.composite_score = null;
      row.sub_rank_current = null;
      row.sub_rank_expense = null;
      row.sub_rank_weighted_ret = null;
      row.sub_rank_div_apy = null;
      row.sub_rank_volatility = null;
      row.sub_rank_thirteen_f = null;
      row.sub_rank_macro_intelligence = null;
      row.sub_rank_governance_layer = null;
      row.sub_rank_political_tracker = null;
      row.sub_rank_token_quality = null;
      row.sub_rank_vol_signed = null;
      continue;
    }
    const rankOverall = row.compositeScore != null ? (rankMap.get(row.compositeScore) ?? null) : null;
    row.rank_overall = rankOverall;
    row.alert_primary = colAL(row.return_weighted_avg ?? 0);
    row.alert_secondary = colAM(row.rsi_14);
    row.target_sleeve_pct = rankOverall != null ? colAU(rankOverall) : 0;
    row.parity_dollars = colAR(row.target_sleeve_pct, totalMV);
    row.parity_change_dollars = colAS(row.parity_dollars, row.market_value ?? 0);
    row.shares_delta = colAT(row.parity_change_dollars, row.price_current ?? 0);
    row.composite_score = row.compositeScore ?? null;
    row.sub_rank_current = row.subRankCurrent ?? null;
    row.sub_rank_expense = row.subRankExpense ?? null;
    row.sub_rank_weighted_ret = row.subRankWeightedRet ?? null;
    row.sub_rank_div_apy = row.subRankDivApy ?? null;
    row.sub_rank_volatility = row.subRankVolatility ?? null;
    row.sub_rank_thirteen_f = row.subRankThirteenF ?? null;
    row.sub_rank_macro_intelligence = row.subRankMacroIntelligence ?? null;
    row.sub_rank_governance_layer = row.subRankGovernanceLayer ?? null;
    row.sub_rank_political_tracker = row.subRankPoliticalTracker ?? null;
    row.sub_rank_token_quality = row.subRankTokenQuality ?? null;
    row.sub_rank_vol_signed = row.subRankVolSigned ?? null;
  }

  const now = new Date().toISOString();
  const upserts = ranked.map((row) => ({
    id: row.id,
    portfolio_id: portfolioId,
    ticker: row.ticker,
    name: row.name ?? null,
    asset_class: row.asset_class,
    currency: row.currency,
    source: row.source,
    expense_ratio: row.expenseRatio,
    quantity: row.quantity,
    target_parity_weight: row.target_parity_weight,
    price_current: row.price_current,
    current_price: row.price_current,
    price_24h_basis: row.price_24h_basis,
    price_7d_basis: row.price_7d_basis,
    basis_price_3mo: row.basis_price_3mo,
    basis_price_6mo: row.basis_price_6mo,
    basis_price_1yr: row.basis_price_1yr,
    basis_price_3yr: row.basis_price_3yr,
    basis_price_5yr: row.basis_price_5yr,
    volatility_3mo: row.volatility_3mo,
    rsi_14: row.rsi_14,
    last_market_refresh: now,
    change_24h: row.change_24h,
    change_7d: row.change_7d,
    return_3mo: row.return_3mo,
    return_6mo: row.return_6mo,
    return_1yr: row.return_1yr,
    return_3yr: row.return_3yr,
    return_5yr: row.return_5yr,
    return_avg: row.return_avg,
    return_weighted_avg: row.return_weighted_avg,
    market_value: row.market_value,
    current_weight: row.currentWeight,
    div_apy: row.divApy,
    sub_rank_current: row.sub_rank_current,
    sub_rank_expense: row.sub_rank_expense,
    sub_rank_weighted_ret: row.sub_rank_weighted_ret,
    sub_rank_div_apy: row.sub_rank_div_apy,
    sub_rank_volatility: row.sub_rank_volatility,
    sub_rank_thirteen_f: row.sub_rank_thirteen_f,
    sub_rank_macro_intelligence: row.sub_rank_macro_intelligence,
    sub_rank_governance_layer: row.sub_rank_governance_layer,
    sub_rank_political_tracker: row.sub_rank_political_tracker,
    sub_rank_token_quality: row.sub_rank_token_quality,
    sub_rank_vol_signed: row.sub_rank_vol_signed,
    composite_score: row.composite_score,
    rank_overall: row.rank_overall,
    alert_primary: row.alert_primary,
    alert_secondary: row.alert_secondary,
    target_sleeve_pct: row.target_sleeve_pct,
    parity_dollars: row.parity_dollars,
    parity_change_dollars: row.parity_change_dollars,
    shares_delta: row.shares_delta,
    row_status: row.rowStatus,
    updated_at: now,
  }));

  const { error: upsertErr } = await supabase.from("portfolio_holdings").upsert(upserts, {
    onConflict: "id",
    defaultToNull: false,
  });
  if (upsertErr) throw upsertErr;
}
