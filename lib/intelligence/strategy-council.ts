/**
 * Strategy Council — aggregates execution, drift, and performance into a sanitized
 * "Institutional Memory" JSON packet (Decimal.js for numeric aggregates).
 * Callers must enforce Autonomous tier and explicit user consent before sending to an LLM.
 */
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { d, computeValueWeightedRsiFromHoldings } from "@/lib/portfolio/precision-money";
import { portfolioNavUsd } from "@/lib/execution/guardrails";
import { portfolioNavUsdVault, isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";

const WINDOW_DAYS = 30;

export type InstitutionalMemoryV1 = {
  version: 1;
  portfolioId: string;
  windowStartUtc: string;
  windowEndUtc: string;
  execution: {
    successCount: number;
    failureCount: number;
    byVenue: Record<string, { success: number; failure: number }>;
  };
  driftBySleeve: Array<{
    sleeveKey: string;
    alertCount: number;
    maxDriftPct: string;
    avgDriftPct: string;
  }>;
  performance: {
    navUsdCurrent: string;
    navUsdWindowStart: string | null;
    navChangePct: string | null;
    valueWeightedRsiCurrent: string | null;
    valueWeightedRsiWindowRef: string | null;
    rsiChangePts: string | null;
  };
  dataGaps: string[];
};

function sleeveAnonymKey(sleeveId: string | null, rank: number): string {
  if (!sleeveId) return `SLEEVE_UNKNOWN_${rank}`;
  return `SLEEVE_${sleeveId.slice(0, 8)}`;
}

async function assertPortfolioOwner(userId: string, portfolioId: string): Promise<boolean> {
  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<{ ok: number }>(
      `SELECT 1 AS ok FROM portfolios WHERE id = $1::uuid AND user_id = $2::uuid`,
      [portfolioId, userId],
    );
    return rows.length > 0;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function loadExecutionStats(
  userId: string,
  portfolioId: string,
  windowStartIso: string,
): Promise<InstitutionalMemoryV1["execution"]> {
  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<{ event_type: string; notes: unknown }>(
      `SELECT event_type, notes
       FROM holding_audit_log
       WHERE portfolio_id = $1::uuid AND user_id = $2::uuid
         AND created_at >= $3::timestamptz
         AND event_type IN ('TRADE_EXECUTION_SUCCESS','TRADE_EXECUTION_FAILURE')`,
      [portfolioId, userId, windowStartIso],
    );
    return aggregateExecutionRows(rows);
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("holding_audit_log")
    .select("event_type, notes")
    .eq("portfolio_id", portfolioId)
    .eq("user_id", userId)
    .gte("created_at", windowStartIso)
    .in("event_type", ["TRADE_EXECUTION_SUCCESS", "TRADE_EXECUTION_FAILURE"]);
  return aggregateExecutionRows((data ?? []) as { event_type: string; notes: unknown }[]);
}

function aggregateExecutionRows(
  rows: ReadonlyArray<{ event_type: string; notes: unknown }>,
): InstitutionalMemoryV1["execution"] {
  let successCount = 0;
  let failureCount = 0;
  const byVenue: Record<string, { success: number; failure: number }> = {};
  for (const r of rows) {
    const ok = r.event_type === "TRADE_EXECUTION_SUCCESS";
    if (ok) successCount += 1;
    else failureCount += 1;
    let venue = "unknown";
    const n = r.notes as Record<string, unknown> | null;
    if (n && typeof n.exchange === "string") venue = String(n.exchange);
    else if (n && typeof n.exchange_name === "string") venue = String(n.exchange_name);
    if (!byVenue[venue]) byVenue[venue] = { success: 0, failure: 0 };
    if (ok) byVenue[venue].success += 1;
    else byVenue[venue].failure += 1;
  }
  return { successCount, failureCount, byVenue };
}

async function loadDriftBySleeve(
  portfolioId: string,
  windowStartIso: string,
): Promise<InstitutionalMemoryV1["driftBySleeve"]> {
  type DriftRow = { sleeve_id: string | null; drift_pct: string | number };
  let raw: DriftRow[] = [];
  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<DriftRow>(
      `SELECT sleeve_id, drift_pct::text AS drift_pct
       FROM portfolio_drift_alerts
       WHERE portfolio_id = $1::uuid AND detected_at >= $2::timestamptz`,
      [portfolioId, windowStartIso],
    );
    raw = rows;
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("portfolio_drift_alerts")
      .select("sleeve_id, drift_pct")
      .eq("portfolio_id", portfolioId)
      .gte("detected_at", windowStartIso);
    raw = (data ?? []) as DriftRow[];
  }

  const map = new Map<string | null, { count: number; max: ReturnType<typeof d>; sum: ReturnType<typeof d> }>();
  for (const row of raw) {
    const pct = d(String(row.drift_pct));
    const cur = map.get(row.sleeve_id) ?? { count: 0, max: d(0), sum: d(0) };
    cur.count += 1;
    cur.max = cur.max.gte(pct) ? cur.max : pct;
    cur.sum = cur.sum.plus(pct);
    map.set(row.sleeve_id, cur);
  }

  return [...map.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([sleeveId, agg], i) => ({
      sleeveKey: sleeveAnonymKey(sleeveId, i),
      alertCount: agg.count,
      maxDriftPct: agg.max.toFixed(8),
      avgDriftPct: agg.sum.div(agg.count).toFixed(8),
    }));
}

async function navCurrent(portfolioId: string): Promise<ReturnType<typeof d>> {
  if (isLocalVaultExecutionPlane()) {
    return portfolioNavUsdVault(portfolioId);
  }
  const supabase = await createClient();
  return portfolioNavUsd(supabase, portfolioId);
}

async function navWindowStartSnapshot(
  portfolioId: string,
  windowStartIso: string,
): Promise<{ nav: ReturnType<typeof d> | null; gap: string | null }> {
  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<{ total_value: string | null }>(
      `SELECT total_value::text
       FROM allocation_snapshots
       WHERE portfolio_id = $1::uuid
         AND created_at >= $2::timestamptz
       ORDER BY created_at ASC
       LIMIT 1`,
      [portfolioId, windowStartIso],
    );
    const v = rows[0]?.total_value;
    if (v == null || v === "") return { nav: null, gap: "no_allocation_snapshot_in_window" };
    return { nav: d(v), gap: null };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("allocation_snapshots")
    .select("total_value")
    .eq("portfolio_id", portfolioId)
    .gte("created_at", windowStartIso)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data || (data as { total_value: unknown }).total_value == null) {
    return { nav: null, gap: "no_allocation_snapshot_in_window" };
  }
  return { nav: d(String((data as { total_value: string | number }).total_value)), gap: null };
}

async function vwRsiCurrent(portfolioId: string): Promise<ReturnType<typeof d> | null> {
  if (isLocalVaultExecutionPlane()) {
    const { rows } = await getVaultPool().query<{ qty: string; price_seed: string; rsi_14: string | null }>(
      `SELECT sh.qty::text, sh.price_seed::text, sh.rsi_14::text
       FROM sleeve_holdings sh
       JOIN sleeves sl ON sl.id = sh.sleeve_id
       WHERE sl.portfolio_id = $1::uuid AND sl.is_active = true`,
      [portfolioId],
    );
    return computeValueWeightedRsiFromHoldings(rows);
  }
  const supabase = await createClient();
  const { data: sleeves } = await supabase
    .from("sleeves")
    .select("id")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true);
  const ids = (sleeves ?? []).map((s: { id: string }) => s.id);
  if (ids.length === 0) return null;
  const { data: holdings } = await supabase
    .from("sleeve_holdings")
    .select("qty, price_seed, rsi_14")
    .in("sleeve_id", ids);
  const rows = (holdings ?? []).map((h) => {
    const row = h as { qty: unknown; price_seed: unknown; rsi_14: unknown };
    return {
      qty: String(row.qty ?? "0"),
      price_seed: String(row.price_seed ?? "0"),
      rsi_14: row.rsi_14 == null ? null : String(row.rsi_14),
    };
  });
  return computeValueWeightedRsiFromHoldings(rows);
}

/**
 * Earliest snapshot date in the window; VW RSI uses snapshot `value` as weight and
 * latest `rsi_14` from holdings (approximation when intraday RSI history is absent).
 */
async function vwRsiAtWindowRef(portfolioId: string, windowStartIso: string): Promise<ReturnType<typeof d> | null> {
  const startDate = windowStartIso.slice(0, 10);
  if (isLocalVaultExecutionPlane()) {
    const { rows: dayRows } = await getVaultPool().query<{ d: string | null }>(
      `SELECT MIN(ss.date)::text AS d
       FROM sleeve_snapshots ss
       JOIN sleeve_holdings sh ON sh.id = ss.holding_id
       JOIN sleeves sl ON sl.id = sh.sleeve_id
       WHERE sl.portfolio_id = $1::uuid AND ss.date >= $2::date`,
      [portfolioId, startDate],
    );
    const day = dayRows[0]?.d;
    if (!day) return null;
    const { rows } = await getVaultPool().query<{ value: string; rsi_14: string | null }>(
      `SELECT ss.value::text, sh.rsi_14::text
       FROM sleeve_snapshots ss
       JOIN sleeve_holdings sh ON sh.id = ss.holding_id
       JOIN sleeves sl ON sl.id = sh.sleeve_id
       WHERE sl.portfolio_id = $1::uuid AND ss.date = $2::date`,
      [portfolioId, day],
    );
    const rsiRows = rows.map((r) => ({
      qty: "1",
      price_seed: r.value,
      rsi_14: r.rsi_14,
    }));
    return computeValueWeightedRsiFromHoldings(rsiRows);
  }

  const supabase = await createClient();
  const { data: sleeves } = await supabase
    .from("sleeves")
    .select("id")
    .eq("portfolio_id", portfolioId)
    .eq("is_active", true);
  const sleeveIds = (sleeves ?? []).map((s: { id: string }) => s.id);
  if (sleeveIds.length === 0) return null;
  const { data: holdings } = await supabase.from("sleeve_holdings").select("id").in("sleeve_id", sleeveIds);
  const hids = (holdings ?? []).map((h: { id: string }) => h.id);
  if (hids.length === 0) return null;

  const { data: dmin } = await supabase
    .from("sleeve_snapshots")
    .select("date")
    .in("holding_id", hids)
    .gte("date", startDate)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!dmin?.date) return null;

  const { data: snaps } = await supabase
    .from("sleeve_snapshots")
    .select("holding_id, value")
    .eq("date", dmin.date)
    .in("holding_id", hids);
  if (!snaps?.length) return null;

  const { data: rsiRows } = await supabase
    .from("sleeve_holdings")
    .select("id, rsi_14")
    .in(
      "id",
      snaps.map((s: { holding_id: string }) => s.holding_id),
    );
  const rsiByHid = new Map((rsiRows ?? []).map((r: { id: string; rsi_14: unknown }) => [r.id, r.rsi_14]));

  const merged = (snaps as { holding_id: string; value: number | string }[]).map((s) => {
    const rsi = rsiByHid.get(s.holding_id);
    return {
      qty: "1",
      price_seed: String(s.value ?? "0"),
      rsi_14: rsi == null ? null : String(rsi),
    };
  });
  return computeValueWeightedRsiFromHoldings(merged);
}

/**
 * Build the Strategy Council context packet. No LLM calls.
 * Execution aggregates omit per-trade tickers (venue-level counts only).
 */
export async function buildStrategyCouncilContextPacket(
  userId: string,
  portfolioId: string,
): Promise<InstitutionalMemoryV1 | null> {
  const ok = await assertPortfolioOwner(userId, portfolioId);
  if (!ok) return null;

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowStartIso = windowStart.toISOString();
  const windowEndIso = windowEnd.toISOString();

  const dataGaps: string[] = [];

  const [execution, driftBySleeve, navNow, navStart, rsiCur, rsiRef] = await Promise.all([
    loadExecutionStats(userId, portfolioId, windowStartIso),
    loadDriftBySleeve(portfolioId, windowStartIso),
    navCurrent(portfolioId),
    navWindowStartSnapshot(portfolioId, windowStartIso),
    vwRsiCurrent(portfolioId),
    vwRsiAtWindowRef(portfolioId, windowStartIso),
  ]);

  if (navStart.gap) dataGaps.push(navStart.gap);

  let navChangePct: string | null = null;
  if (navStart.nav && !navStart.nav.isZero()) {
    navChangePct = navNow.minus(navStart.nav).div(navStart.nav).mul(100).toFixed(8);
  }

  let rsiChangePts: string | null = null;
  if (rsiCur && rsiRef) {
    rsiChangePts = rsiCur.minus(rsiRef).toFixed(8);
  } else if (!rsiRef) {
    dataGaps.push("vw_rsi_window_ref_unavailable");
  }

  return {
    version: 1,
    portfolioId,
    windowStartUtc: windowStartIso,
    windowEndUtc: windowEndIso,
    execution,
    driftBySleeve,
    performance: {
      navUsdCurrent: navNow.toFixed(4),
      navUsdWindowStart: navStart.nav ? navStart.nav.toFixed(4) : null,
      navChangePct,
      valueWeightedRsiCurrent: rsiCur ? rsiCur.toFixed(8) : null,
      valueWeightedRsiWindowRef: rsiRef ? rsiRef.toFixed(8) : null,
      rsiChangePts,
    },
    dataGaps,
  };
}
