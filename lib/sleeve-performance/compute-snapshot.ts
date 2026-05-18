import "server-only";

import { colAM } from "@/lib/portfolio/formula-engine";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadOwnerSleevePublishMetrics } from "@/lib/marketplace/sleeve-publish-metrics";
import { computeLetterGrade } from "@/lib/sleeve-performance/utils";
import type { SleeveBlueprintV1 } from "@/lib/portfolio/export-sleeve-strategy";

export type SleeveSnapshotRow = {
  avg_drift_pct: number | null;
  max_drift_pct: number | null;
  entry_signal_count: number;
  hold_signal_count: number;
  exit_signal_count: number;
  total_holdings_count: number;
  avg_composite_score: number | null;
  grade: string | null;
  was_published: boolean;
};

type MarketplaceStrategyRow = {
  id: string;
  publisher_user_id: string | null;
  strategy_grade: number | string;
  blueprint_json: SleeveBlueprintV1 | null;
  metadata: Record<string, unknown> | null;
};

function parseSourceSleeveId(metadata: Record<string, unknown> | null): string | null {
  const raw = metadata?.sourceSleeveId ?? metadata?.source_sleeve_id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

function countSignalsFromRsi(
  holdings: ReadonlyArray<{ rsi_14: number | null }>,
): Pick<SleeveSnapshotRow, "entry_signal_count" | "hold_signal_count" | "exit_signal_count"> {
  let entry = 0;
  let hold = 0;
  let exit = 0;
  for (const h of holdings) {
    const rsi = h.rsi_14 != null ? Number(h.rsi_14) : null;
    const signal = colAM(rsi);
    if (signal === "Consider Entry") entry += 1;
    else if (signal === "Consider Exit") exit += 1;
    else if (signal === "Hold") hold += 1;
  }
  return { entry_signal_count: entry, hold_signal_count: hold, exit_signal_count: exit };
}

async function loadSleeveHoldingsDrift(
  sleeveId: string,
): Promise<{ drifts: number[]; holdings: Array<{ rsi_14: number | null }> } | null> {
  const { data: holdings, error } = await supabaseAdmin
    .from("sleeve_holdings")
    .select("qty, price_seed, target_wt_pct, rsi_14")
    .eq("sleeve_id", sleeveId);

  if (error || !holdings?.length) return null;

  let totalMv = 0;
  const rows = holdings.map((h) => {
    const qty = Number(h.qty ?? 0);
    const price = Number(h.price_seed ?? 0);
    const mv = qty * price;
    totalMv += mv;
    return {
      mv,
      targetPct: Number(h.target_wt_pct ?? 0),
      rsi_14: h.rsi_14 != null ? Number(h.rsi_14) : null,
    };
  });

  if (totalMv <= 0) {
    return { drifts: [], holdings: rows.map((r) => ({ rsi_14: r.rsi_14 })) };
  }

  const drifts: number[] = [];
  for (const r of rows) {
    if (r.mv <= 0) continue;
    const actualPct = (r.mv / totalMv) * 100;
    drifts.push(Math.abs(actualPct - r.targetPct));
  }

  return { drifts, holdings: rows.map((r) => ({ rsi_14: r.rsi_14 })) };
}

/**
 * Weekly snapshot for a published marketplace strategy (percentages/scores only).
 * Uses publisher source sleeve when metadata includes sourceSleeveId; otherwise blueprint aggregates.
 */
export async function computeSleeveSnapshotForStrategy(
  strategy: MarketplaceStrategyRow,
): Promise<SleeveSnapshotRow | null> {
  const strategyGrade = Number(strategy.strategy_grade);
  const avgComposite = Number.isFinite(strategyGrade) ? strategyGrade : null;
  const grade = avgComposite != null ? computeLetterGrade(avgComposite) : null;

  const publisherId = strategy.publisher_user_id;
  const sourceSleeveId = parseSourceSleeveId(strategy.metadata);

  if (publisherId && sourceSleeveId) {
    const live = await loadSleeveHoldingsDrift(sourceSleeveId);
    if (live && live.drifts.length > 0) {
      const avgDrift = live.drifts.reduce((s, d) => s + d, 0) / live.drifts.length;
      const maxDrift = Math.max(...live.drifts);
      const signals = countSignalsFromRsi(live.holdings);
      return {
        avg_drift_pct: Number(avgDrift.toFixed(3)),
        max_drift_pct: Number(maxDrift.toFixed(3)),
        ...signals,
        total_holdings_count: live.holdings.length,
        avg_composite_score: avgComposite,
        grade,
        was_published: true,
      };
    }

    const metrics = await loadOwnerSleevePublishMetrics(publisherId, sourceSleeveId);
    if (metrics?.meanAbsDriftPct) {
      const meanDrift = Number(metrics.meanAbsDriftPct.toFixed(3));
      return {
        avg_drift_pct: meanDrift,
        max_drift_pct: meanDrift,
        entry_signal_count: 0,
        hold_signal_count: 0,
        exit_signal_count: 0,
        total_holdings_count: strategy.blueprint_json?.target_allocation?.length ?? 0,
        avg_composite_score: avgComposite,
        grade,
        was_published: true,
      };
    }
  }

  const slots = strategy.blueprint_json?.target_allocation?.length ?? 0;
  if (slots === 0) return null;

  return {
    avg_drift_pct: null,
    max_drift_pct: null,
    entry_signal_count: 0,
    hold_signal_count: slots,
    exit_signal_count: 0,
    total_holdings_count: slots,
    avg_composite_score: avgComposite,
    grade,
    was_published: true,
  };
}
