/**
 * Next.js instrumentation hook — runs once on server startup (Node.js runtime only).
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateAnthropicConfig } = await import("@/lib/constants/ai-models");
    try {
      validateAnthropicConfig();
    } catch (e) {
      console.error("[startup]", e instanceof Error ? e.message : String(e));
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
