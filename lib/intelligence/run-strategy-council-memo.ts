import "server-only";

import { canAccessWatcher } from "@/lib/portfolio/intelligence-access";
import { getActiveServiceKeysForUser } from "@/lib/services/user-entitlements";
import { buildStrategyCouncilContextPacket } from "@/lib/intelligence/strategy-council";
import { generateMonthlyMemo } from "@/lib/intelligence/strategy-council-memo";
import { buildFallbackStrategyCouncilMemo } from "@/lib/intelligence/strategy-council-fallback-memo";
import type { StrategyCouncilMemoPayload } from "@/lib/services/ai";

export type StrategyCouncilMemoResult =
  | {
      success: true;
      markdown: string;
      pdfLayout: StrategyCouncilMemoPayload["pdfLayout"];
      contextVersion: number;
      usedFallback: boolean;
    }
  | { success: false; error: string };

export async function runStrategyCouncilMemoGeneration(
  userId: string,
  portfolioId: string,
): Promise<StrategyCouncilMemoResult> {
  const keys = await getActiveServiceKeysForUser(userId);
  if (!canAccessWatcher(keys)) {
    return {
      success: false,
      error: "Intelligence tier or higher required to generate the monthly memo.",
    };
  }

  const packet = await buildStrategyCouncilContextPacket(userId, portfolioId);
  if (!packet) {
    return { success: false, error: "Portfolio not found or inaccessible." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    const fallback = buildFallbackStrategyCouncilMemo(packet);
    return {
      success: true,
      markdown: fallback.markdown,
      pdfLayout: fallback.pdfLayout,
      contextVersion: packet.version,
      usedFallback: true,
    };
  }

  try {
    const memo = await generateMonthlyMemo(packet, userId);
    return {
      success: true,
      markdown: memo.markdown,
      pdfLayout: memo.pdfLayout,
      contextVersion: packet.version,
      usedFallback: false,
    };
  } catch (err) {
    console.error("[strategy-council] Claude memo failed, using fallback:", err);
    const fallback = buildFallbackStrategyCouncilMemo(packet);
    return {
      success: true,
      markdown: fallback.markdown,
      pdfLayout: fallback.pdfLayout,
      contextVersion: packet.version,
      usedFallback: true,
    };
  }
}
