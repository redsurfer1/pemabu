import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withAuth } from "@/lib/api/auth";
import { createClient } from "@/lib/supabase/server";

const PatchHoldingSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  asset_class: z.enum(["equity", "fixed_income", "alternatives", "cash", "other"]).optional(),
  quantity: z.number().positive().optional(),
  cost_basis: z.number().nonnegative().nullable().optional(),
  currency: z.enum(["USD", "GBP", "EUR", "CAD", "AUD"]).optional(),
  expense_ratio: z.number().min(0).max(1).nullable().optional(),
  target_weight_pct: z.number().min(0).max(100).nullable().optional(),
});

/**
 * Two-step ownership: avoids PostgREST embed name mismatches on
 * `portfolios!inner(user_id)` joins.
 */
async function verifyHoldingOwner(
  supabase: SupabaseClient,
  holdingId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: holding, error: holdingErr } = await supabase
    .from("portfolio_holdings")
    .select("id, portfolio_id")
    .eq("id", holdingId)
    .single();

  if (holdingErr || !holding) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const { data: portfolio, error: portfolioErr } = await supabase
    .from("portfolios")
    .select("user_id")
    .eq("id", holding.portfolio_id)
    .single();

  if (portfolioErr || !portfolio || portfolio.user_id !== userId) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  return { ok: true };
}

export const PATCH = withAuth(async (req, user, ctx) => {
  const { id: idParam } = await ctx.params;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const access = await verifyHoldingOwner(supabase, id, user.id);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchHoldingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const patch = parsed.data;
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      updatePayload[key] = value;
    }
  }

  if (Object.keys(updatePayload).length === 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await supabase
    .from("portfolio_holdings")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ holding: updated });
});

export const DELETE = withAuth(async (_req, user, ctx) => {
  const { id: idParam } = await ctx.params;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  if (!id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const access = await verifyHoldingOwner(supabase, id, user.id);
  if (!access.ok) return access.response;

  const { error: deleteErr } = await supabase.from("portfolio_holdings").delete().eq("id", id);

  if (deleteErr) {
    console.error("Delete holding error:", deleteErr);
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
