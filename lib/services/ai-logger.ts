import { supabaseAdmin } from "@/lib/supabase/admin";

export type AiFeature =
  | "signal_narrative"
  | "portfolio_brief"
  | "explain_holding"
  | "governance_summary"
  | "strategy_council_memo";

/** Deterministic lowercase‑hex SHA‑256 digest (Node 18+ Web Crypto). */
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Persist one AI interaction to ai_interaction_log.
 * Designed to never throw — failures are silently swallowed so logging
 * never breaks the primary user flow.
 */
export async function logAiInteraction(input: {
  userId: string;
  feature: AiFeature;
  model: string;
  prompt: string;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
  responsePreview: string;
  disclaimerShown: boolean;
}): Promise<void> {
  try {
    const promptHash = await sha256Hex(input.prompt);
    const { error } = await supabaseAdmin.from("ai_interaction_log").insert({
      user_id: input.userId,
      feature: input.feature,
      model: input.model,
      prompt_hash: promptHash,
      prompt_tokens: input.promptTokens,
      output_tokens: input.outputTokens,
      latency_ms: input.latencyMs,
      response_preview: input.responsePreview.slice(0, 500),
      disclaimer_shown: input.disclaimerShown,
    });
    if (error) {
      console.error("[ai-logger] insert error:", error.message);
    }
  } catch (err) {
    console.error("[ai-logger] unexpected error:", err);
  }
}

/**
 * Count of AI interactions for a user in a given time window.
 * Used by the compliance export to show summary stats.
 */
export async function countAiInteractions(
  userId: string,
  since: string,
): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from("ai_interaction_log")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  } catch {
    return 0;
  }
}
