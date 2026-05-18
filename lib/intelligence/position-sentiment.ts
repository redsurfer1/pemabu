export type PositionSentiment = "accumulating" | "holding" | "decreasing" | "no_position";

/** Compares current vs prior exposure (shares, notional midpoint, etc.). */
export function computePositionSentiment(
  current: number | null,
  prior: number | null,
): PositionSentiment {
  const cur = current ?? 0;
  const prev = prior ?? 0;

  if (cur <= 0 && prev <= 0) return "no_position";
  if (cur <= 0 && prev > 0) return "no_position";
  if (cur > 0 && prev <= 0) return "accumulating";
  if (cur > prev) return "accumulating";
  if (cur < prev) return "decreasing";
  return "holding";
}
