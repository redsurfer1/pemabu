export const FACTOR_COLUMNS = [
  "factor_expense",
  "factor_target_allocation",
  "factor_weighted_return",
  "factor_pct_weight",
  "factor_div_apy",
  "factor_volatility",
  "factor_thirteen_f",
  "factor_macro_intelligence",
  "factor_governance_layer",
  "factor_political_tracker",
  "factor_token_quality",
] as const;

export function factorAssignments(prefix: string): string {
  return FACTOR_COLUMNS.map((c) => `${prefix}${c}`).join(",\n         ");
}

export function extractFactorValues(payload: Record<string, unknown>): unknown[] {
  return FACTOR_COLUMNS.map((c) => payload[c]);
}

export function isMissingColumnError(err: unknown): boolean {
  const msg = String(
    err && typeof err === "object" && "message" in err
      ? (err as { message: string }).message
      : err,
  ).toLowerCase();
  return (
    msg.includes("column") &&
    (msg.includes("does not exist") ||
      msg.includes("could not find") ||
      msg.includes("unknown"))
  );
}
