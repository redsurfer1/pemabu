import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { classifyMacroRegime } from "@/lib/intelligence/macro-regime";
import { refreshMacroCorrelationCache } from "@/lib/intelligence/macro-correlation-cache";
import { assertServiceAccess } from "@/lib/security/tier-guard";
import { z } from "zod";

const ADDON = "addon_macro_intelligence";

const IndicatorsSchema = z.object({
  vix: z.number(),
  yield10y: z.number(),
  yield2y: z.number(),
  dxy: z.number(),
  goldPct30d: z.number(),
  btcPct30d: z.number(),
  sp500Pct30d: z.number(),
});

export const POST = withAuth(async (req, user) => {
  await assertServiceAccess(user.id, ADDON);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = IndicatorsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const classification = classifyMacroRegime(parsed.data);

  const { error } = await supabaseAdmin.from("macro_regime_history").insert({
    user_id: user.id,
    regime: classification.regime,
    confidence_pct: classification.confidencePct,
    indicator_vix: parsed.data.vix,
    indicator_yield_10y: parsed.data.yield10y,
    indicator_yield_2y: parsed.data.yield2y,
    indicator_dxy: parsed.data.dxy,
    indicator_gold_pct: parsed.data.goldPct30d,
    indicator_btc_pct: parsed.data.btcPct30d,
    indicator_sp500_pct: parsed.data.sp500Pct30d,
    suggested_weights: classification.suggestedWeights,
  });

  if (error) console.error("Failed to persist regime history:", error);

  void refreshMacroCorrelationCache(supabaseAdmin).catch((e) => console.error("macro correlation refresh:", e));

  return NextResponse.json({ classification });
});
