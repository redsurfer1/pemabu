import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeSleeveSnapshotForStrategy } from "@/lib/sleeve-performance/compute-snapshot";
import { getISOWeekStart } from "@/lib/sleeve-performance/utils";
import { toRecordOrNull } from "@/lib/supabase/typed";
import { withCronSentry } from "@/lib/monitoring/cron-sentry";
import { verifyCronRequest } from "@/lib/cron/verify";
import { PERFORMANCE_HISTORY_NOTICE } from "@/lib/constants/performance-history";
import { updateStrategyPerformanceSummary } from "@/lib/sleeve-performance/update-summary";
import type { SleeveBlueprintV1 } from "@/lib/portfolio/export-sleeve-strategy";

const PAGE_SIZE = 200;

const handler = async (req: Request) => {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = getISOWeekStart(new Date());
  const results = {
    processed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const allStrategies: Array<{
    id: unknown;
    publisher_user_id: unknown;
    strategy_grade: unknown;
    blueprint_json: unknown;
    metadata: unknown;
  }> = [];
  let from = 0;
  let page: typeof allStrategies;
  do {
    const { data: strategies, error: strategiesError } = await supabaseAdmin
      .from("marketplace_strategies")
      .select("id, publisher_user_id, strategy_grade, blueprint_json, metadata")
      .range(from, from + PAGE_SIZE - 1);

    if (strategiesError) {
      console.error("[sleeve-snapshot] Failed to load strategies:", strategiesError.message);
      return NextResponse.json({ error: "Failed to load strategies" }, { status: 500 });
    }
    page = (strategies ?? []) as typeof allStrategies;
    allStrategies.push(...page);
    from += PAGE_SIZE;
  } while (page.length === PAGE_SIZE);

  for (const row of allStrategies) {
    const strategyId = String(row.id);
    try {
      const snapshot = await computeSleeveSnapshotForStrategy({
        id: strategyId,
        publisher_user_id: row.publisher_user_id as string | null,
        strategy_grade: row.strategy_grade as number | string,
        blueprint_json: row.blueprint_json as SleeveBlueprintV1 | null,
        metadata: toRecordOrNull(row.metadata),
      });

      if (!snapshot) {
        results.skipped += 1;
        continue;
      }

      const { error: insertError } = await supabaseAdmin.from("sleeve_performance_log").upsert(
        {
          sleeve_id: strategyId,
          recorded_week: weekStart,
          ...snapshot,
        },
        { onConflict: "sleeve_id,recorded_week", ignoreDuplicates: true },
      );

      if (insertError) {
        if (insertError.code === "23505") {
          results.skipped += 1;
        } else {
          results.errors.push(`${strategyId}: ${insertError.message}`);
        }
      } else {
        results.processed += 1;
        await updateStrategyPerformanceSummary(strategyId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      results.errors.push(`${strategyId}: ${message}`);
    }
  }

  console.info("[sleeve-snapshot] Week:", weekStart, "Results:", results);

  return NextResponse.json({
    week: weekStart,
    ...results,
    note: PERFORMANCE_HISTORY_NOTICE,
  });
};

export const GET = withCronSentry("sleeve-performance-snapshot", handler);
export const POST = withCronSentry("sleeve-performance-snapshot", handler);
