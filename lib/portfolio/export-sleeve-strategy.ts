import { createHash, randomBytes } from "node:crypto";
import { d } from "@/lib/portfolio/precision-money";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";
import {
  type FactorWeights,
  type SleeveFactorMetadata,
  factorWeightsFromDbRow,
} from "@/lib/portfolio/portfolio-factors";

export const WATCHER_DEFAULT_DRIFT_THRESHOLD_PCT = "5";

export type SleeveBlueprintV1 = {
  version: 1;
  schema: "pemabu.sleeve_blueprint.v1";
  generatedAt: string;
  nonce: string;
  weighting_method: string;
  budget_pct: string;
  purpose: string;
  watcher_config: {
    driftAlertThresholdPct: string;
    notes: string;
  };
  target_allocation: Array<{
    slot: number;
    theme: string;
    status: string;
    target_wt_pct: string;
    expense_ratio: string;
    sort_order: number;
  }>;
  aggregate_signal_quality: {
    target_weighted_rsi: string | null;
  };
  /** Relative factor weights only — no NAV, quantities, or dollar totals. */
  factor_metadata?: SleeveFactorMetadata;
};

async function loadPortfolioFactorWeights(
  portfolioId: string,
  vault: boolean,
): Promise<FactorWeights> {
  if (vault) {
    const pool = getVaultPool();
    const { rows } = await pool.query<Record<string, unknown>>(
      `SELECT * FROM portfolio_assumptions WHERE portfolio_id = $1::uuid`,
      [portfolioId],
    );
    if (rows[0]) return factorWeightsFromDbRow(rows[0]);
    return factorWeightsFromDbRow({});
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolio_assumptions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .maybeSingle();
  return factorWeightsFromDbRow((data as Record<string, unknown>) ?? {});
}

function targetWeightedRsi(
  rows: ReadonlyArray<{ target_wt_pct: string; rsi_14: string | null }>,
): ReturnType<typeof d> | null {
  let num = d(0);
  let den = d(0);
  for (const r of rows) {
    if (r.rsi_14 == null || String(r.rsi_14).trim() === "") continue;
    const w = d(String(r.target_wt_pct));
    if (w.lte(0)) continue;
    num = num.plus(w.mul(d(String(r.rsi_14))));
    den = den.plus(w);
  }
  if (den.isZero()) return null;
  return num.div(den);
}

/** Deterministic fingerprint for marketplace de-duplication (not reversible to token). */
export function hashSleeveToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Portable sleeve blueprint: ratios and protocol fields only — no tickers, names, qty, price, cost basis, NAV.
 */
export async function exportSleeveStrategy(userId: string, sleeveId: string): Promise<{ blueprint: SleeveBlueprintV1; sleeveToken: string } | null> {
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

    const { rows: srows } = await pool.query<{
      weighting_method: string;
      budget_pct: string;
      purpose: string;
      portfolio_id: string;
    }>(
      `SELECT weighting_method, budget_pct::text, purpose, portfolio_id::text
       FROM sleeves WHERE id = $1::uuid`,
      [sleeveId],
    );
    const s = srows[0];
    if (!s) return null;

    const { rows: hrows } = await pool.query<{
      target_wt_pct: string;
      theme: string;
      status: string;
      expense_ratio: string;
      sort_order: number;
      rsi_14: string | null;
    }>(
      `SELECT target_wt_pct::text, theme, status, expense_ratio::text, sort_order, rsi_14::text
       FROM sleeve_holdings
       WHERE sleeve_id = $1::uuid
       ORDER BY sort_order ASC, id ASC`,
      [sleeveId],
    );

    const rsi = targetWeightedRsi(hrows);
    const factorWeights = await loadPortfolioFactorWeights(s.portfolio_id, true);
    const blueprint: SleeveBlueprintV1 = {
      version: 1,
      schema: "pemabu.sleeve_blueprint.v1",
      generatedAt: new Date().toISOString(),
      nonce: randomBytes(16).toString("hex"),
      weighting_method: s.weighting_method,
      budget_pct: d(s.budget_pct).toFixed(8),
      purpose: s.purpose,
      watcher_config: {
        driftAlertThresholdPct: WATCHER_DEFAULT_DRIFT_THRESHOLD_PCT,
        notes: "Protocol-aligned drift alerts; no venue identifiers.",
      },
      target_allocation: hrows.map((h, i) => ({
        slot: i,
        theme: h.theme,
        status: h.status,
        target_wt_pct: d(h.target_wt_pct).toFixed(8),
        expense_ratio: d(h.expense_ratio).toFixed(8),
        sort_order: h.sort_order,
      })),
      aggregate_signal_quality: {
        target_weighted_rsi: rsi ? rsi.toFixed(8) : null,
      },
      factor_metadata: {
        factor_schema_version: 1,
        factor_weights: factorWeights,
      },
    };

    const sleeveToken = Buffer.from(JSON.stringify(blueprint), "utf8").toString("base64url");
    return { blueprint, sleeveToken };
  }

  const supabase = await createClient();
  const { data: sleeve, error: e1 } = await supabase
    .from("sleeves")
    .select("id, weighting_method, budget_pct, purpose, portfolio_id")
    .eq("id", sleeveId)
    .maybeSingle();
  if (e1 || !sleeve) return null;
  const row = sleeve as {
    weighting_method: string;
    budget_pct: number | string;
    purpose: string;
    portfolio_id: string;
  };
  const { data: port } = await supabase.from("portfolios").select("user_id").eq("id", row.portfolio_id).maybeSingle();
  if (!port || (port as { user_id: string }).user_id !== userId) return null;

  const { data: holdings, error: e2 } = await supabase
    .from("sleeve_holdings")
    .select("target_wt_pct, theme, status, expense_ratio, sort_order, rsi_14")
    .eq("sleeve_id", sleeveId)
    .order("sort_order", { ascending: true });
  if (e2) return null;

  const hrows = (holdings ?? []).map((h) => {
    const x = h as {
      target_wt_pct: number | string;
      theme: string;
      status: string;
      expense_ratio: number | string;
      sort_order: number;
      rsi_14: number | string | null;
    };
    return {
      target_wt_pct: String(x.target_wt_pct ?? "0"),
      theme: x.theme,
      status: x.status,
      expense_ratio: String(x.expense_ratio ?? "0"),
      sort_order: x.sort_order,
      rsi_14: x.rsi_14 == null ? null : String(x.rsi_14),
    };
  });

  const rsi = targetWeightedRsi(hrows);
  const factorWeights = await loadPortfolioFactorWeights(row.portfolio_id, false);
  const blueprint: SleeveBlueprintV1 = {
    version: 1,
    schema: "pemabu.sleeve_blueprint.v1",
    generatedAt: new Date().toISOString(),
    nonce: randomBytes(16).toString("hex"),
    weighting_method: row.weighting_method,
    budget_pct: d(String(row.budget_pct ?? 0)).toFixed(8),
    purpose: row.purpose,
    watcher_config: {
      driftAlertThresholdPct: WATCHER_DEFAULT_DRIFT_THRESHOLD_PCT,
      notes: "Protocol-aligned drift alerts; no venue identifiers.",
    },
    target_allocation: hrows.map((h, i) => ({
      slot: i,
      theme: h.theme,
      status: h.status,
      target_wt_pct: d(h.target_wt_pct).toFixed(8),
      expense_ratio: d(h.expense_ratio).toFixed(8),
      sort_order: h.sort_order,
    })),
    aggregate_signal_quality: {
      target_weighted_rsi: rsi ? rsi.toFixed(8) : null,
    },
    factor_metadata: {
      factor_schema_version: 1,
      factor_weights: factorWeights,
    },
  };

  const sleeveToken = Buffer.from(JSON.stringify(blueprint), "utf8").toString("base64url");
  return { blueprint, sleeveToken };
}
