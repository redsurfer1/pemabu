import { describe, expect, it } from "vitest";
import { computeValueWeightedRsiFromHoldings, d } from "@/lib/portfolio/precision-money";

describe("Value-weighted RSI (Decimal.js)", () => {
  it("matches closed-form benchmark to 8 decimal places (no float drift)", () => {
    const rows = [
      { qty: "2", price_seed: "10", rsi_14: "50" },
      { qty: "3", price_seed: "10", rsi_14: "60" },
    ];
    const agg = computeValueWeightedRsiFromHoldings(rows);
    expect(agg).not.toBeNull();
    expect(agg!.toFixed(8)).toBe("56.00000000");
  });

  it("handles fractional notionals without premature Number casting", () => {
    const rows = [
      { qty: "0.1", price_seed: "10.1", rsi_14: "55.123456789" },
      { qty: "0.2", price_seed: "20.2", rsi_14: "44.987654321" },
    ];
    const agg = computeValueWeightedRsiFromHoldings(rows);
    expect(agg).not.toBeNull();
    const manual = d("0.1")
      .mul("10.1")
      .mul("55.123456789")
      .plus(d("0.2").mul("20.2").mul("44.987654321"))
      .div(d("0.1").mul("10.1").plus(d("0.2").mul("20.2")));
    expect(agg!.toFixed(8)).toBe(manual.toFixed(8));
  });
});
