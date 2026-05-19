import { generateStrategyCouncilMonthlyMemo, type StrategyCouncilMemoPayload } from "@/lib/services/ai";
import type { InstitutionalMemoryV1 } from "@/lib/intelligence/strategy-council";

/**
 * Executive memo from a pre-built Institutional Memory packet.
 * Call only from tier-gated, user-initiated server actions.
 */
export async function generateMonthlyMemo(
  packet: InstitutionalMemoryV1,
  userId?: string,
): Promise<StrategyCouncilMemoPayload> {
  return generateStrategyCouncilMonthlyMemo(JSON.stringify(packet), userId);
}
