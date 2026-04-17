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
} from "@/lib/allocation/engine";
import type { Quote as MarketQuote } from "@/lib/market-data/types";
import type { Holding } from "@/lib/types/database";

function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

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

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  const errors: string[] = [];

  try {
    const { data: holdings, error: hErr } = await supabaseAdmin.from("portfolio_holdings").select("*");

    if (hErr) throw hErr;

    const allHoldings = (holdings ?? []) as Holding[];
    const tickers = [...new Set(allHoldings.map((h) => h.ticker))];
    log.push(`Refreshing ${tickers.length} unique tickers`);

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
            metadata: drift as unknown as Record<string, unknown>,
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

    // Portfolio signal refresh is handled by Supabase Edge Function
    // supabase/functions/refresh-portfolio-signals/index.ts
    // Scheduled via pg_cron at 01:00 UTC
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
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
      engine_refresh,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await alertOperator("Nightly refresh FAILED", `Error: ${msg}`).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
