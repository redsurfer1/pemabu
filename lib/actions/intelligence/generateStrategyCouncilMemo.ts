"use server";

import { createClient } from "@/lib/supabase/server";
import { runStrategyCouncilMemoGeneration } from "@/lib/intelligence/run-strategy-council-memo";

/**
 * Explicit user trigger: builds the context packet, then calls Claude once.
 * No background jobs; Intelligence tier or higher.
 */
export async function generateStrategyCouncilMemoAction(portfolioId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Unauthenticated" };

  const result = await runStrategyCouncilMemoGeneration(user.id, portfolioId);
  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  return {
    success: true as const,
    markdown: result.markdown,
    pdfLayout: result.pdfLayout,
    contextVersion: result.contextVersion,
    usedFallback: result.usedFallback,
  };
}
