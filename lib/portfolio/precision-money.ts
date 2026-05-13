import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function d(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

/** Coerce DB / JSON scalars without constructing Decimal from a binary float. */
export function decimalFromDbNumeric(value: unknown): Decimal {
  if (value === null || value === undefined) return d(0);
  if (value instanceof Decimal) return value;
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" ? d(0) : new Decimal(t);
  }
  if (typeof value === "number") {
    return new Decimal(String(value));
  }
  return new Decimal(String(value));
}

export function ledgerDecimal(value: Decimal | Decimal.Value): Decimal {
  if (value instanceof Decimal) return value;
  return decimalFromDbNumeric(value);
}

export function positionMarketValue(qty: Decimal.Value, price: Decimal.Value): Decimal {
  return d(qty).mul(d(price));
}

export function valueWeightedAverage(
  pairs: ReadonlyArray<{ value: Decimal | Decimal.Value; reading: Decimal | Decimal.Value }>,
): Decimal | null {
  let num = d(0);
  let den = d(0);
  for (const { value, reading } of pairs) {
    const v = ledgerDecimal(value);
    const r = ledgerDecimal(reading);
    if (v.isZero()) continue;
    num = num.plus(v.mul(r));
    den = den.plus(v);
  }
  if (den.isZero()) return null;
  return num.div(den);
}

/**
 * Value-weighted RSI over holdings using Decimal for every multiply, sum, and division.
 * Pass decimal strings from SQL (`::text`) or stringified Supabase fields — never raw JS floats.
 */
export function computeValueWeightedRsiFromHoldings(
  rows: ReadonlyArray<{ qty: string; price_seed: string; rsi_14: string | null }>,
): Decimal | null {
  let num = d(0);
  let den = d(0);
  for (const row of rows) {
    if (row.rsi_14 === null || row.rsi_14.trim() === "") continue;
    const mv = d(row.qty).mul(d(row.price_seed));
    if (mv.isZero()) continue;
    const rsi = d(row.rsi_14);
    num = num.plus(mv.mul(rsi));
    den = den.plus(mv);
  }
  if (den.isZero()) return null;
  return num.div(den);
}
