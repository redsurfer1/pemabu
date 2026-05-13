import type { PlaceOrderInput } from "@/lib/execution/types";

/**
 * Returns true only when EXECUTION_LIVE_MODE is explicitly set to "true".
 * Any other value — including absence, "false", "1", or typos — returns false.
 * This is intentionally strict: opt-in to live execution, not opt-out.
 */
export function isLiveExecutionMode(): boolean {
  return process.env.EXECUTION_LIVE_MODE === "true";
}

/**
 * Logs a clear warning when a provider falls back to stub mode.
 * Visible in Docker logs and local terminal.
 */
export function logStubModeWarning(provider: string, proposal: PlaceOrderInput): void {
  console.warn(
    `[PEMABU EXECUTION — STUB MODE] ${provider} provider is operating in stub mode. ` +
      `Set EXECUTION_LIVE_MODE=true to enable real order placement. ` +
      `Proposal: ${JSON.stringify(proposal)}`,
  );
}
