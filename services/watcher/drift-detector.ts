import { d } from "../../lib/portfolio/precision-money";
import { getVaultPool } from "../../lib/db";
import type { PoolClient } from "pg";
import { pingFlomismaTradePending, pingFlomismaWatcherUpdate } from "../../lib/execution/flomisma-signal";

const DRIFT_THRESHOLD = d("5");

type HoldingRow = {
  id: string;
  sleeve_id: string;
  portfolio_id: string;
  user_id: string;
  ticker: string;
  qty: string;
  price_seed: string;
  target_wt_pct: string;
};

async function loadHoldings(client: PoolClient): Promise<HoldingRow[]> {
  const { rows } = await client.query<HoldingRow>(
    `SELECT sh.id,
            sh.sleeve_id,
            sl.portfolio_id,
            p.user_id::text as user_id,
            sh.ticker,
            sh.qty::text,
            sh.price_seed::text,
            sh.target_wt_pct::text
     FROM sleeve_holdings sh
     JOIN sleeves sl ON sl.id = sh.sleeve_id
     JOIN portfolios p ON p.id = sl.portfolio_id
     WHERE sl.is_active = true
       AND p.system_status = 'ACTIVE'
       AND (p.watcher_cooldown_until IS NULL OR p.watcher_cooldown_until <= now())
       AND EXISTS (
         SELECT 1 FROM public.user_subscriptions us
         WHERE us.user_id = p.user_id
           AND us.status IN ('active', 'trial', 'complimentary')
           AND us.service_key IN ('intelligence_annual', 'autonomous_annual')
       )`,
  );
  return rows;
}

export async function runDriftDetectorCycle(): Promise<void> {
  const pool = getVaultPool();
  const client = await pool.connect();
  let driftAlert = false;
  let tradePending = false;
  try {
    const rows = await loadHoldings(client);
    const bySleeve = new Map<string, HoldingRow[]>();
    for (const r of rows) {
      const list = bySleeve.get(r.sleeve_id) ?? [];
      list.push(r);
      bySleeve.set(r.sleeve_id, list);
    }

    for (const [, list] of bySleeve) {
      let sleeveNav = d(0);
      for (const h of list) {
        sleeveNav = sleeveNav.plus(d(h.qty).mul(d(h.price_seed)));
      }
      if (sleeveNav.isZero()) continue;

      const portfolioId = list[0]!.portfolio_id;

      for (const h of list) {
        const mv = d(h.qty).mul(d(h.price_seed));
        const currentWtPct = mv.div(sleeveNav).mul(100);
        const targetWtPct = d(h.target_wt_pct);
        const driftPct = currentWtPct.minus(targetWtPct).abs();
        if (driftPct.gt(DRIFT_THRESHOLD)) {
          await client.query(
            `INSERT INTO portfolio_drift_alerts (portfolio_id, sleeve_id, holding_id, drift_pct, metric)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::numeric, 'TARGET_WEIGHT')`,
            [portfolioId, h.sleeve_id, h.id, driftPct.toFixed(8)],
          );
          driftAlert = true;

          const action = currentWtPct.gt(targetWtPct) ? "SELL" : "BUY";
          const qtyAdj = d(h.qty).mul(driftPct.div(100)).abs();
          const qtyStr = qtyAdj.isZero() ? "0" : qtyAdj.toFixed(8);

          const { rows: pr } = await client.query<{ id: string | null }>(
            `SELECT watcher_create_trade_proposal_and_audit(
               $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8::numeric, $9::numeric
             ) AS id`,
            [
              h.user_id,
              portfolioId,
              h.sleeve_id,
              h.id,
              h.ticker,
              "alpaca",
              action,
              qtyStr,
              driftPct.toFixed(8),
            ],
          );
          if (pr[0]?.id) {
            tradePending = true;
          }
        }
      }
    }

    if (driftAlert) {
      await pingFlomismaWatcherUpdate();
    }
    if (tradePending) {
      await pingFlomismaTradePending();
    }
  } finally {
    client.release();
  }
}
