"use server";

import { isAutonomous } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { createClient } from "@/lib/supabase/server";
import { buildStrategyCouncilContextPacket } from "@/lib/intelligence/strategy-council";
import { generateMonthlyMemo } from "@/lib/intelligence/strategy-council-memo";

/**
 * Explicit user trigger: builds the context packet, then calls Claude once.
 * No background jobs; Autonomous tier only.
 */
export async function generateStrategyCouncilMemoAction(portfolioId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: "Unauthenticated" };

  const keys = await getActiveServiceKeysForUser(user.id);
  if (!isAutonomous(keys)) {
    return { success: false as const, error: "Autonomous tier required" };
  }

  const packet = await buildStrategyCouncilContextPacket(user.id, portfolioId);
  if (!packet) return { success: false as const, error: "Portfolio not found or inaccessible" };

  const memo = await generateMonthlyMemo(packet);
  return { success: true as const, markdown: memo.markdown, pdfLayout: memo.pdfLayout, contextVersion: packet.version };
}
