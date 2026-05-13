import { computeValueWeightedRsiFromHoldings, d } from "@/lib/portfolio/precision-money";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";

export interface MorningBriefContext {
  version: 1;
  generatedAt: string;
  portfolioId: string;
  topAlerts: Array<{
    rank: number;
    driftPct: string;
    metric: string;
    detectedAt: string;
  }>;
  valueWeightedRsi: string | null;
}

function isLocalVaultMode(): boolean {
  return process.env.USE_LOCAL_VAULT === "true";
}

function driftPctToJsonString(raw: string | number): string {
  return d(typeof raw === "number" ? String(raw) : raw).toFixed(8);
}

/**
 * Sanitized JSON for morning brief pipelines: no tickers, no NAV totals, no raw positions.
 * Value-weighted RSI is computed entirely in Decimal.js from string inputs (no float accumulation).
 */
export async function generateMorningBriefContext(
  userId: string,
  portfolioId: string,
): Promise<MorningBriefContext | null> {
  const supabase = await createClient();
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!portfolio) return null;

  const generatedAt = new Date().toISOString();

  if (isLocalVaultMode()) {
    const pool = getVaultPool();
    const alerts = await pool.query<{
      drift_pct: string;
      metric: string;
      detected_at: string;
    }>(
      `SELECT drift_pct::text, metric, detected_at::text
       FROM portfolio_drift_alerts
       WHERE portfolio_id = $1
       ORDER BY detected_at DESC
       LIMIT 3`,
      [portfolioId],
    );

    const rsiRows = await pool.query<{
      qty: string;
      price_seed: string;
      rsi_14: string | null;
    }>(
      `SELECT sh.qty::text, sh.price_seed::text, sh.rsi_14::text
       FROM sleeve_holdings sh
       JOIN sleeves sl ON sl.id = sh.sleeve_id
       WHERE sl.portfolio_id = $1
         AND sl.is_active = true`,
      [portfolioId],
    );

    const rsiDec = computeValueWeightedRsiFromHoldings(rsiRows.rows);
    const rsiVw = rsiDec ? rsiDec.toFixed(8) : null;

    return {
      version: 1,
      generatedAt,
      portfolioId,
      topAlerts: alerts.rows.map((r, i) => ({
        rank: i + 1,
        driftPct: driftPctToJsonString(r.drift_pct),
        metric: r.metric,
        detectedAt: r.detected_at,
      })),
      valueWeightedRsi: rsiVw,
    };
  }

  const { data: alertRows } = await supabase
    .from("portfolio_drift_alerts")
    .select("drift_pct, metric, detected_at")
    .eq("portfolio_id", portfolioId)
    .order("detected_at", { ascending: false })
    .limit(3);

  const { data: sleeves } = await supabase
    .from("sleeves")
    .select("id")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true);
  const sleeveIds = (sleeves ?? []).map((s: { id: string }) => s.id);
  let rsiVw: string | null = null;
  if (sleeveIds.length > 0) {
    const { data: holdings } = await supabase
      .from("sleeve_holdings")
      .select("qty, price_seed, rsi_14")
      .in("sleeve_id", sleeveIds);
    const rows = (holdings ?? []).map((h) => {
      const row = h as { qty: unknown; price_seed: unknown; rsi_14: unknown };
      return {
        qty: String(row.qty ?? "0"),
        price_seed: String(row.price_seed ?? "0"),
        rsi_14: row.rsi_14 === null || row.rsi_14 === undefined ? null : String(row.rsi_14),
      };
    });
    const rsiDec = computeValueWeightedRsiFromHoldings(rows);
    rsiVw = rsiDec ? rsiDec.toFixed(8) : null;
  }

  return {
    version: 1,
    generatedAt,
    portfolioId,
    topAlerts: (alertRows ?? []).map((r, i) => ({
      rank: i + 1,
      driftPct: driftPctToJsonString((r as { drift_pct: string | number }).drift_pct),
      metric: (r as { metric: string }).metric,
      detectedAt: (r as { detected_at: string }).detected_at,
    })),
    valueWeightedRsi: rsiVw,
  };
}
