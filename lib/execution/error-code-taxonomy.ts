/**
 * Execution / venue error classification for circuit breaker (safety vs network).
 */
export type ExecutionFailureCategory = "HARD" | "SOFT";

const HARD = new Set<string>([
  "BALANCE_INSUFFICIENT",
  "INVALID_API_KEY",
  "ORDER_REJECTED",
  "DECRYPT_FAILED",
  "INSUFFICIENT_FUNDS",
  "ACCOUNT_DISABLED",
]);

const SOFT = new Set<string>([
  "NETWORK_TIMEOUT",
  "RATE_LIMIT_EXCEEDED",
  "SERVICE_UNAVAILABLE",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]);

export function classifyExecutionErrorCode(errorCode: string | null | undefined): ExecutionFailureCategory {
  const c = (errorCode ?? "UNKNOWN").trim().toUpperCase();
  if (SOFT.has(c)) return "SOFT";
  if (HARD.has(c)) return "HARD";
  /* Unknown / provider-specific: treat as hard for conservative safety */
  return "HARD";
}
