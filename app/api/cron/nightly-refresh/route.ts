import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveProvider } from "@/lib/market-data";
import { alertOperator } from "@/lib/services/email";
import {
  calculateAllocationWeights,
  detectDrift,
  buildSnapshotData,
  DEFAULT_TARGETS,
  type Quote as EngineQuote,
} from "@/lib/allocation/asset-class-utils";
import { withCronSentry } from "@/lib/monitoring/cron-sentry";
import { getBaseUrl } from "@/lib/app-url";
import { verifyCronRequest } from "@/lib/cron/verify";
import { toRecord } from "@/lib/supabase/typed";
import type { Quote as MarketQuote } from "@/lib/market-data/types";
import type { Holding } from "@/lib/types/database";

const PAGE_SIZE = 500;

function toEngineQuotesMap(quotes: MarketQuote[]): Map<string, EngineQuote> {
  const m = new Map<string, EngineQuote>();
  for (const q of quotes) {
    m.set(q.ticker, {
      ticker: q.ticker,
      price: q.price,
      currency: q.currency,
      asOf: q.asOf,
      source: q.source,
    });
  }
  return m;
}

async function loadAllHoldings(): Promise<Holding[]> {
  const all: Holding[] = [];
  let from = 0;
  let page: Holding[];
  do {
    const { data: holdings, error } = await supabaseAdmin
      .from("portfolio_holdings")
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    page = (holdings ?? []) as Holding[];
    all.push(...page);
    from += PAGE_SIZE;
  } while (page.length === PAGE_SIZE);
  return all;
}

const handler = async (req: Request) => {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  const errors: string[] = [];

  try {
    const allHoldings = await loadAllHoldings();

    const nonCashHoldings = allHoldings.filter((h) => h.asset_class !== "cash");
    const cashHoldings = allHoldings.filter((h) => h.asset_class === "cash");

    const tickers = [...new Set(nonCashHoldings.map((h) => h.ticker))];
    log.push(`Refreshing ${tickers.length} unique tickers (${cashHoldings.length} cash skipped, ${allHoldings.length} total holdings)`);

    for (const cashHolding of cashHoldings) {
      await supabaseAdmin
        .from("portfolio_holdings")
        .update({
          current_price: 1.00,
          last_change_pct: 0,
          last_price_refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cashHolding.id);
    }

    const provider = getActiveProvider();
    const health = await provider.healthCheck();
    if (!health.ok) {
      await alertOperator(
        "Nightly refresh: provider unhealthy",
        `Provider: ${health.provider}\n` + `Message: ${health.message ?? "no detail"}`,
      );
      return NextResponse.json({ error: "Provider unhealthy", health }, { status: 503 });
    }

    const result = await provider.getQuotes(tickers);
    const changePctByTicker = new Map<string, number>();
    for (const q of result.quotes) {
      changePctByTicker.set(q.ticker.toUpperCase(), q.changePercent);
    }

    for (const err of result.errors) {
      errors.push(`${err.ticker}: ${err.kind}`);
      if (err.kind === "auth_error") {
        await alertOperator("Nightly refresh: auth_error", `Ticker: ${err.ticker}\n${err.message}`);
      }
    }

    const quotesMap = toEngineQuotesMap(result.quotes);

    if (cashHoldings.length > 0) {
      quotesMap.set("CASH", {
        ticker: "CASH",
        price: 1.00,
        currency: "USD",
        asOf: new Date(),
        source: "fixed",
      });
    }

    for (const holding of allHoldings) {
      const quote = quotesMap.get(holding.ticker);
      if (!quote) continue;
      const changePct = changePctByTicker.get(holding.ticker.toUpperCase()) ?? null;
      await supabaseAdmin
        .from("portfolio_holdings")
        .update({
          current_price: quote.price,
          last_change_pct: changePct,
          last_price_refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", holding.id);
    }
    log.push(`Updated prices for ${result.quotes.length} tickers`);

    const portfolioIds = [...new Set(allHoldings.map((h) => h.portfolio_id))];

    for (const portfolioId of portfolioIds) {
      const portfolioHoldings = allHoldings.filter((h) => h.portfolio_id === portfolioId);
      const weights = calculateAllocationWeights(portfolioHoldings, quotesMap, DEFAULT_TARGETS);
      const drifts = detectDrift(weights);

      for (const drift of drifts) {
        const { data: existing } = await supabaseAdmin
          .from("signals")
          .select("id")
          .eq("portfolio_id", portfolioId)
          .eq("type", "drift")
          .eq("status", "unacknowledged")
          .limit(1);

        if (existing && existing.length > 0) continue;

        const { data: signal } = await supabaseAdmin
          .from("signals")
          .insert({
            portfolio_id: portfolioId,
            type: "drift",
            severity: Math.abs(drift.drift_pct) > 10 ? "critical" : "warning",
            status: "unacknowledged",
            title: `${drift.asset_class} allocation drift`,
            message:
              `${drift.asset_class} is ${drift.direction === "over" ? "above" : "below"} target by ` +
              `${Math.abs(drift.drift_pct).toFixed(1)}%`,
            metadata: toRecord(drift),
          })
          .select()
          .single();

        if (signal) {
          const affectedHolding = portfolioHoldings.find((h) => h.asset_class === drift.asset_class);
          if (affectedHolding) {
            await supabaseAdmin.from("drift_events").insert({
              portfolio_id: portfolioId,
              holding_id: affectedHolding.id,
              signal_id: signal.id,
              asset_class: drift.asset_class,
              target_pct: drift.target_pct,
              actual_pct: drift.actual_pct,
              threshold_pct: 5,
              direction: drift.direction,
            });
          }
        }
      }

      const snapshotData = buildSnapshotData(portfolioHoldings, weights, quotesMap);
      const totalValue = portfolioHoldings.reduce((sum, h) => {
        const q = quotesMap.get(h.ticker);
        const price = q?.price ?? Number(h.current_price) ?? 0;
        return sum + Number(h.quantity) * price;
      }, 0);
      await supabaseAdmin.from("allocation_snapshots").insert({
        portfolio_id: portfolioId,
        snapshot_data: snapshotData,
        total_value: Math.round(totalValue * 100) / 100,
        triggered_by: "nightly_cron",
      });
    }

    log.push(`Processed ${portfolioIds.length} portfolios`);

    const baseUrl = getBaseUrl();
    const edgeUrl = `${baseUrl}/functions/v1/refresh-portfolio-signals`;
    let engine_refresh: unknown = { error: "Edge Function unreachable" };
    try {
      const edgeRes = await fetch(edgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pemabu-cron-secret": process.env.PEMABU_CRON_SECRET ?? "",
        },
        body: "{}",
      });
      engine_refresh = edgeRes.ok ? await edgeRes.json() : { error: `Edge HTTP ${edgeRes.status}` };
      if (!edgeRes.ok) {
        console.error("[nightly-refresh] Edge Function delegation failed", edgeRes.status);
      }
    } catch (edgeErr) {
      const msg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
      console.error("[nightly-refresh] Edge Function unreachable", msg);
      engine_refresh = { error: "Edge Function unreachable" };
    }

    return NextResponse.json({
      success: true,
      log,
      errors,
      processed: portfolioIds.length,
      total_holdings: allHoldings.length,
      engine_refresh,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertOperator("Nightly refresh FAILED", `Error: ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
};

export const GET = withCronSentry("nightly-refresh", handler);
