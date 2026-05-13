import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { d, computeValueWeightedRsiFromHoldings } from "@/lib/portfolio/precision-money";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";
import type { Decimal } from "decimal.js";

export type SleevePublishSignalMetrics = {
  liveVwRsi: Decimal | null;
  meanAbsDriftPct: Decimal | null;
};

/**
 * Owner-only, anonymized aggregates for marketplace grading (no export of line-level tickers in API responses).
 */
export async function loadOwnerSleevePublishMetrics(
  userId: string,
  sleeveId: string,
): Promise<SleevePublishSignalMetrics | null> {
  if (isLocalVaultExecutionPlane()) {
    const pool = getVaultPool();
    const { rows: own } = await pool.query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM sleeves sl
       JOIN portfolios p ON p.id = sl.portfolio_id
       WHERE sl.id = $1::uuid AND p.user_id = $2::uuid`,
      [sleeveId, userId],
    );
    if (!own.length) return null;

    const { rows: hrows } = await pool.query<{
      qty: string;
      price_seed: string;
      rsi_14: string | null;
      target_wt_pct: string;
    }>(
      `SELECT sh.qty::text, sh.price_seed::text, sh.rsi_14::text, sh.target_wt_pct::text
       FROM sleeve_holdings sh
       WHERE sh.sleeve_id = $1::uuid`,
      [sleeveId],
    );
    return aggregateMetricsFromRows(hrows);
  }

  const supabase = await createClient();
  const { data: sleeve, error: e1 } = await supabase
    .from("sleeves")
    .select("id, portfolio_id")
    .eq("id", sleeveId)
    .maybeSingle();
  if (e1 || !sleeve) return null;
  const { data: port } = await supabase
    .from("portfolios")
    .select("user_id")
    .eq("id", (sleeve as { portfolio_id: string }).portfolio_id)
    .maybeSingle();
  if (!port || (port as { user_id: string }).user_id !== userId) return null;

  const { data: holdings, error: e2 } = await supabase
    .from("sleeve_holdings")
    .select("qty, price_seed, rsi_14, target_wt_pct")
    .eq("sleeve_id", sleeveId);
  if (e2) return null;

  const hrows = (holdings ?? []).map((h) => {
    const x = h as {
      qty: number | string;
      price_seed: number | string;
      rsi_14: number | string | null;
      target_wt_pct: number | string;
    };
    return {
      qty: String(x.qty ?? 0),
      price_seed: String(x.price_seed ?? 0),
      rsi_14: x.rsi_14 == null ? null : String(x.rsi_14),
      target_wt_pct: String(x.target_wt_pct ?? 0),
    };
  });
  return aggregateMetricsFromRows(hrows);
}

function aggregateMetricsFromRows(
  hrows: ReadonlyArray<{
    qty: string;
    price_seed: string;
    rsi_14: string | null;
    target_wt_pct: string;
  }>,
): SleevePublishSignalMetrics {
  const vw = computeValueWeightedRsiFromHoldings(hrows);

  let totalMv = d(0);
  for (const r of hrows) {
    totalMv = totalMv.plus(d(r.qty).mul(d(r.price_seed)));
  }

  if (totalMv.isZero()) {
    return { liveVwRsi: vw, meanAbsDriftPct: null };
  }

  let sumAbs = d(0);
  let n = 0;
  for (const r of hrows) {
    const mv = d(r.qty).mul(d(r.price_seed));
    if (mv.isZero()) continue;
    const actualPct = mv.div(totalMv).mul(d(100));
    const targetPct = d(r.target_wt_pct);
    sumAbs = sumAbs.plus(actualPct.minus(targetPct).abs());
    n += 1;
  }
  const meanAbs = n > 0 ? sumAbs.div(d(n)) : null;
  return { liveVwRsi: vw, meanAbsDriftPct: meanAbs };
}
