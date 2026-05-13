"use server";

import { exportSleeveStrategy } from "@/lib/portfolio/export-sleeve-strategy";
import { createClient } from "@/lib/supabase/server";

/** Portable sleeve blueprint (ratios + protocol only). */
export async function exportSleeveStrategyAction(sleeveId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Unauthenticated" };

  const out = await exportSleeveStrategy(user.id, sleeveId);
  if (!out) return { success: false as const, error: "Sleeve not found" };
  return { success: true as const, blueprint: out.blueprint, sleeveToken: out.sleeveToken };
}
