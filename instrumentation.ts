/**
 * Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Used here to surface configuration problems early (before the first real
 * request hits) rather than letting them surface as cryptic runtime errors.
 */
export async function register() {
  // Only validate in the Node.js runtime — not in the Edge runtime which has
  // different env access semantics.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateAnthropicConfig } = await import("@/lib/constants/ai-models");
    try {
      validateAnthropicConfig();
    } catch (e) {
      // Log as an error but do not crash — AI features will fail at call-time
      // with a clear SDK error; other features (dashboard, portfolio, etc.) must
      // continue to function without a configured Anthropic key.
      console.error("[startup]", e instanceof Error ? e.message : String(e));
    }
  }
}
