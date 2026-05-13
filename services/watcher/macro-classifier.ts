// Watcher: weekly macro regime classification (uses Yahoo chart data via fetchMarketData).

import { supabaseAdmin } from "../../lib/supabase/admin";
import { fetchMarketData } from "../../lib/market-data/yahoo-finance";
import { classifyMacroRegime, type MacroIndicators } from "../../lib/intelligence/macro-regime";
import { refreshMacroCorrelationCache } from "../../lib/intelligence/macro-correlation-cache";

function pct30dFromBases(price: number, basis3mo: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(basis3mo) || basis3mo <= 0) return 0;
  return ((price / basis3mo) - 1) * 100;
}

async function loadIndicators(): Promise<MacroIndicators> {
  const [vix, tnx, irx, dxy, gold, btc, gspc] = await Promise.all([
    fetchMarketData("^VIX"),
    fetchMarketData("^TNX"),
    fetchMarketData("^IRX"),
    fetchMarketData("DX-Y.NYB"),
    fetchMarketData("GC=F"),
    fetchMarketData("BTC-USD"),
    fetchMarketData("^GSPC"),
  ]);

  return {
    vix: vix.price1,
    yield10y: tnx.price1,
    yield2y: irx.price1,
    dxy: dxy.price1,
    goldPct30d: pct30dFromBases(gold.price1, gold.basisPrice3mo),
    btcPct30d: pct30dFromBases(btc.price1, btc.basisPrice3mo),
    sp500Pct30d: pct30dFromBases(gspc.price1, gspc.basisPrice3mo),
  };
}

export async function runWeeklyMacroClassification(): Promise<void> {
  console.log("[watcher] weekly macro regime classification…");

  const indicators = await loadIndicators();
  const classification = classifyMacroRegime(indicators);
  console.log(
    `[watcher] macro regime ${classification.regime} (${classification.confidencePct}%)`,
  );

  const { data: subscribers, error: subErr } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id")
    .eq("service_key", "addon_macro_intelligence")
    .in("status", ["active", "complimentary", "trial"]);

  if (subErr) {
    console.error("[watcher] macro subscribers query:", subErr.message);
    return;
  }

  if (!subscribers?.length) {
    console.log("[watcher] no Macro Intelligence subscribers — skipping history insert.");
    return;
  }

  const rows = subscribers.map((s: { user_id: string }) => ({
    user_id: s.user_id,
    regime: classification.regime,
    confidence_pct: classification.confidencePct,
    indicator_vix: indicators.vix,
    indicator_yield_10y: indicators.yield10y,
    indicator_yield_2y: indicators.yield2y,
    indicator_dxy: indicators.dxy,
    indicator_gold_pct: indicators.goldPct30d,
    indicator_btc_pct: indicators.btcPct30d,
    indicator_sp500_pct: indicators.sp500Pct30d,
    suggested_weights: classification.suggestedWeights,
    notes: "Auto-classified by watcher agent",
  }));

  const { error } = await supabaseAdmin.from("macro_regime_history").insert(rows);
  if (error) {
    console.error("[watcher] macro history insert:", error.message);
    return;
  }

  void refreshMacroCorrelationCache(supabaseAdmin).catch((e) =>
    console.error("[watcher] macro correlation refresh:", e),
  );

  console.log(`[watcher] macro regime stored for ${rows.length} subscriber(s).`);
}
