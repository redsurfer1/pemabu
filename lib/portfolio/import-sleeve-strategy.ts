import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getVaultPool } from "@/lib/db";
import { d } from "@/lib/portfolio/precision-money";
import { isLocalVaultExecutionPlane } from "@/lib/execution/vault-execution-plane";
import { insertHoldingAuditRow } from "@/lib/portfolio/holding-audit";
import type { SleevePurpose, SleeveWeightingMethod } from "@/types/allocation";

const WEIGHTING: ReadonlySet<string> = new Set(["COMPOSITE_SCORE", "YIELD_PROPORTIONAL", "MANUAL"]);
const PURPOSES: ReadonlySet<string> = new Set(["Appreciation", "Income", "Stability", "Growth", "Custom"]);

const BlueprintSchema = z.object({
  version: z.literal(1),
  schema: z.literal("pemabu.sleeve_blueprint.v1"),
  weighting_method: z.string(),
  budget_pct: z.string(),
  purpose: z.string(),
  watcher_config: z.object({
    driftAlertThresholdPct: z.string(),
    notes: z.string(),
  }),
  target_allocation: z.array(
    z.object({
      slot: z.number().int().nonnegative(),
      theme: z.string(),
      status: z.string(),
      target_wt_pct: z.string(),
      expense_ratio: z.string(),
      sort_order: z.number().int(),
    }),
  ),
});

function parseBlueprint(token: string): z.infer<typeof BlueprintSchema> | null {
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    const raw = JSON.parse(json) as unknown;
    const p = BlueprintSchema.safeParse(raw);
    return p.success ? p.data : null;
  } catch {
    return null;
  }
}

function normalizePurpose(p: string): SleevePurpose {
  return PURPOSES.has(p) ? (p as SleevePurpose) : "Custom";
}

function normalizeWeighting(w: string): SleeveWeightingMethod {
  return WEIGHTING.has(w) ? (w as SleeveWeightingMethod) : "COMPOSITE_SCORE";
}

/** Target weights within the sleeve should sum to ~100 (percentage points). */
function validateTargetWeightsSum(target_allocation: z.infer<typeof BlueprintSchema>["target_allocation"]): boolean {
  let sum = d(0);
  for (const row of target_allocation) {
    sum = sum.plus(d(row.target_wt_pct));
  }
  return sum.minus(d(100)).abs().lte(d("0.5"));
}

/**
 * Decode a SleeveToken and create a new sleeve with protocol targets only (placeholder tickers, zero qty).
 * Does not modify other sleeves or existing holdings.
 */
export async function importSleeveStrategy(
  userId: string,
  portfolioId: string,
  sleeveToken: string,
): Promise<{ ok: true; sleeveId: string } | { ok: false; error: string }> {
  const trimmed = sleeveToken.trim();
  const parsed = parseBlueprint(trimmed);
  if (!parsed) return { ok: false, error: "Invalid sleeve token" };
  if (!validateTargetWeightsSum(parsed.target_allocation)) {
    return { ok: false, error: "Target allocation weights must sum to 100% (±0.5%)" };
  }

  const budgetPct = d(parsed.budget_pct);
  if (budgetPct.lte(0) || budgetPct.gt(1)) {
    return { ok: false, error: "Invalid sleeve budget in blueprint" };
  }

  const purpose = normalizePurpose(parsed.purpose);
  const weightingMethod = normalizeWeighting(parsed.weighting_method);

  if (isLocalVaultExecutionPlane()) {
    const pool = getVaultPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: own } = await client.query<{ ok: number }>(
        `SELECT 1 AS ok FROM portfolios WHERE id = $1::uuid AND user_id = $2::uuid`,
        [portfolioId, userId],
      );
      if (!own.length) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Portfolio not found" };
      }

      const { rows: existing } = await client.query<{ budget_pct: string }>(
        `SELECT budget_pct::text FROM sleeves WHERE portfolio_id = $1::uuid AND is_active = true`,
        [portfolioId],
      );
      const existingTotal = existing.reduce((s, r) => s.plus(d(r.budget_pct)), d(0));
      if (existingTotal.plus(budgetPct).gt(d("1.001"))) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Blueprint budget would exceed portfolio sleeve budget cap" };
      }

      const { rows: orderRows } = await client.query<{ m: number }>(
        `SELECT COALESCE(MAX(sort_order), -1) AS m FROM sleeves WHERE portfolio_id = $1::uuid`,
        [portfolioId],
      );
      const sortOrder = Number(orderRows[0]?.m ?? -1) + 1;

      const name = `Protocol import — ${purpose}`;
      const ins = await client.query<{ id: string }>(
        `INSERT INTO sleeves (
           portfolio_id, name, purpose, budget_pct, sort_order, is_active, weighting_method
         ) VALUES ($1::uuid, $2, $3, $4::numeric, $5, true, $6)
         RETURNING id::text`,
        [portfolioId, name, purpose, budgetPct.toFixed(), sortOrder, weightingMethod],
      );
      const sleeveId = ins.rows[0]?.id;
      if (!sleeveId) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Sleeve insert failed" };
      }

      for (const row of parsed.target_allocation) {
        const ticker = `_PRT${row.slot}`;
        await client.query(
          `INSERT INTO sleeve_holdings (
             sleeve_id, ticker, name, status, theme, qty, price_seed, expense_ratio,
             div_dollar, target_wt_pct, sort_order, manual_pricing
           ) VALUES (
             $1::uuid, $2, '', $3, $4, 0, 0, $5::numeric, 0, $6::numeric, $7, false
           )`,
          [
            sleeveId,
            ticker,
            row.status,
            row.theme,
            d(row.expense_ratio).toFixed(),
            d(row.target_wt_pct).toFixed(),
            row.sort_order,
          ],
        );
      }

      await client.query(
        `INSERT INTO holding_audit_log (
           user_id, portfolio_id, sleeve_id, holding_id, event_type, ticker,
           quantity_before, quantity_after, cost_basis_before, cost_basis_after, notes
         ) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          userId,
          portfolioId,
          sleeveId,
          null,
          "STRATEGY_IMPORT_SUCCESS",
          "_IMPORT_",
          null,
          null,
          null,
          null,
          JSON.stringify({
            blueprintSchema: parsed.schema,
            watcher_config: parsed.watcher_config,
            slotCount: parsed.target_allocation.length,
          }),
        ],
      );

      await client.query("COMMIT");
      return { ok: true, sleeveId };
    } catch (e) {
      await client.query("ROLLBACK");
      return { ok: false, error: e instanceof Error ? e.message : "Import failed" };
    } finally {
      client.release();
    }
  }

  const supabase = await createClient();
  const { data: port } = await supabase.from("portfolios").select("id").eq("id", portfolioId).eq("user_id", userId).maybeSingle();
  if (!port) return { ok: false, error: "Portfolio not found" };

  const { data: existing } = await supabase.from("sleeves").select("budget_pct").eq("portfolio_id", portfolioId).eq("is_active", true);
  const existingTotal = (existing ?? []).reduce((s: number, r: { budget_pct: number }) => s + Number(r.budget_pct), 0);
  if (existingTotal + Number(budgetPct.toFixed(8)) > 1.001) {
    return { ok: false, error: "Blueprint budget would exceed portfolio sleeve budget cap" };
  }

  const { data: maxSleeve } = await supabase
    .from("sleeves")
    .select("sort_order")
    .eq("portfolio_id", portfolioId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = maxSleeve ? (maxSleeve as { sort_order: number }).sort_order + 1 : 0;

  const { data: sleeve, error: se } = await supabase
    .from("sleeves")
    .insert({
      portfolio_id: portfolioId,
      name: `Protocol import — ${purpose}`,
      purpose,
      budget_pct: Number(budgetPct.toFixed(8)),
      sort_order: sortOrder,
      is_active: true,
      weighting_method: weightingMethod,
    })
    .select("id")
    .single();
  if (se || !sleeve) return { ok: false, error: se?.message ?? "Sleeve insert failed" };

  const sleeveId = (sleeve as { id: string }).id;

  const holdings = parsed.target_allocation.map((row) => ({
    sleeve_id: sleeveId,
    ticker: `_PRT${row.slot}`,
    name: "",
    status: row.status,
    theme: row.theme,
    qty: 0,
    price_seed: 0,
    expense_ratio: Number(d(row.expense_ratio).toFixed(8)),
    div_dollar: 0,
    target_wt_pct: Number(d(row.target_wt_pct).toFixed(8)),
    sort_order: row.sort_order,
    manual_pricing: false,
  }));

  const { error: he } = await supabase.from("sleeve_holdings").insert(holdings);
  if (he) {
    await supabase.from("sleeves").delete().eq("id", sleeveId);
    return { ok: false, error: he.message };
  }

  const { error: ae } = await insertHoldingAuditRow(supabase, {
    userId,
    portfolioId,
    sleeveId,
    holdingId: null,
    eventType: "STRATEGY_IMPORT_SUCCESS",
    ticker: "_IMPORT_",
    quantityBefore: null,
    quantityAfter: null,
    costBasisBefore: null,
    costBasisAfter: null,
    notes: {
      blueprintSchema: parsed.schema,
      watcher_config: parsed.watcher_config,
      slotCount: parsed.target_allocation.length,
    },
  });
  if (ae) {
    await supabase.from("sleeve_holdings").delete().eq("sleeve_id", sleeveId);
    await supabase.from("sleeves").delete().eq("id", sleeveId);
    return { ok: false, error: ae };
  }

  return { ok: true, sleeveId };
}
