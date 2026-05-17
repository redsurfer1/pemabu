import { describe, expect, test } from "vitest";
import Decimal from "decimal.js";
import {
  DEFAULT_FACTOR_WEIGHTS,
  FACTOR_WEIGHT_KEYS,
  normaliseFactorWeights,
  sumFactorWeights,
} from "./portfolio-factors";

describe("portfolio-factors", () => {
  test("default weights sum to 1", () => {
    expect(sumFactorWeights(DEFAULT_FACTOR_WEIGHTS).toNumber()).toBeCloseTo(1, 8);
    expect(FACTOR_WEIGHT_KEYS).toHaveLength(10);
  });

  test("normaliseFactorWeights uses Decimal precision", () => {
    const skewed = { ...DEFAULT_FACTOR_WEIGHTS, expense: 0.5, pctWeight: 0.5 };
    for (const k of FACTOR_WEIGHT_KEYS) {
      if (k !== "expense" && k !== "pctWeight") skewed[k] = 0;
    }
    const out = normaliseFactorWeights(skewed);
    const sum = FACTOR_WEIGHT_KEYS.reduce((s, k) => s.plus(out[k]), new Decimal(0));
    expect(sum.toNumber()).toBeCloseTo(1, 8);
  });
});
