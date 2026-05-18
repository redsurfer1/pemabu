import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeSleeveSnapshotForStrategy } from "@/lib/sleeve-performance/compute-snapshot";
import { getISOWeekStart } from "@/lib/sleeve-performance/utils";
import { PERFORMANCE_HISTORY_NOTICE } from "@/lib/constants/performance-history";
import type { SleeveBlueprintV1 } from "@/lib/portfolio/export-sleeve-strategy";

function verifyCronSecret(req: Request): boolean {
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  return runSnapshot(req);
}

export async function POST(req: Request) {
  return runSnapshot(req);
}

async function runSnapshot(req: Request): Promise<NextResponse> {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekStart = getISOWeekStart(new Date());
  const results = {
    processed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const { data: strategies, error: strategiesError } = await supabaseAdmin
    .from("marketplace_strategies")
    .select("id, publisher_user_id, strategy_grade, blueprint_json, metadata");

  if (strategiesError) {
    console.error("[sleeve-snapshot] Failed to load strategies:", strategiesError.message);
    return NextResponse.json({ error: "Failed to load strategies" }, { status: 500 });
  }

  for (const row of strategies ?? []) {
    const strategyId = String(row.id);
    try {
      const snapshot = await computeSleeveSnapshotForStrategy({
        id: strategyId,
        publisher_user_id: row.publisher_user_id as string | null,
        strategy_grade: row.strategy_grade as number | string,
        blueprint_json: row.blueprint_json as SleeveBlueprintV1 | null,
        metadata: (row.metadata as Record<string, unknown> | null) ?? null,
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
}
