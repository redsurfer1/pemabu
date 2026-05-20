import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Holding } from "@/lib/types/database";

vi.mock("server-only", () => ({}));

import {
  calculateHoldingValue,
  calculatePortfolioValue,
  calculateAllocationWeights,
  calculateHoldingWeights,
  detectDrift,
  DEFAULT_TARGETS,
  type Quote,
} from "@/lib/allocation/asset-class-utils";
import type { AllocationWeight } from "@/lib/types/database";

const makeHolding = (
  overrides: Partial<Holding> & { id: string; ticker: string },
): Holding => ({
  id: overrides.id,
  portfolio_id: overrides.portfolio_id ?? "pf-1",
  ticker: overrides.ticker,
  name: overrides.name ?? overrides.ticker,
  asset_class: overrides.asset_class ?? "equity",
  quantity: overrides.quantity ?? 10,
  current_price: overrides.current_price ?? 100,
  currency: overrides.currency ?? "USD",
  source: overrides.source ?? "manual",
  created_at: overrides.created_at ?? "2025-01-01T00:00:00Z",
  updated_at: overrides.updated_at ?? "2025-01-01T00:00:00Z",
  cost_basis: overrides.cost_basis ?? null,
  expense_ratio: overrides.expense_ratio ?? null,
  target_weight_pct: overrides.target_weight_pct ?? null,
  row_status: overrides.row_status ?? undefined,
  last_change_pct: overrides.last_change_pct ?? null,
  last_price_refreshed_at: overrides.last_price_refreshed_at ?? null,
});

const makeQuote = (overrides: Partial<Quote> & { ticker: string }): Quote => ({
  ticker: overrides.ticker,
  price: overrides.price ?? 100,
  currency: overrides.currency ?? "USD",
  asOf: overrides.asOf ?? new Date(),
  source: overrides.source ?? "tiingo",
});

describe("Market data → allocation pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateHoldingValue", () => {
    it("uses quote price when provided", () => {
      const h = makeHolding({ id: "h1", ticker: "AAPL", quantity: 10 });
      const q = makeQuote({ ticker: "AAPL", price: 150 });
      expect(calculateHoldingValue(h, q)).toBe(1500);
    });

    it("falls back to current_price when no quote", () => {
      const h = makeHolding({
        id: "h1",
        ticker: "AAPL",
        quantity: 10,
        current_price: 100,
      });
      expect(calculateHoldingValue(h)).toBe(1000);
    });

    it("returns 0 for zero quantity", () => {
      const h = makeHolding({
        id: "h1",
        ticker: "AAPL",
        quantity: 0,
        current_price: 100,
      });
      const q = makeQuote({ ticker: "AAPL", price: 150 });
      expect(calculateHoldingValue(h, q)).toBe(0);
    });
  });

  describe("calculatePortfolioValue", () => {
    it("sums all holdings with their quotes", () => {
      const holdings = [
        makeHolding({ id: "h1", ticker: "AAPL", quantity: 10 }),
        makeHolding({ id: "h2", ticker: "GOOGL", quantity: 5 }),
      ];
      const quotes = new Map<string, Quote>([
        ["AAPL", makeQuote({ ticker: "AAPL", price: 150 })],
        ["GOOGL", makeQuote({ ticker: "GOOGL", price: 200 })],
      ]);
      expect(calculatePortfolioValue(holdings, quotes)).toBe(2500);
    });

    it("prices cash holdings at $1.00 regardless of quote", () => {
      const holdings = [
        makeHolding({
          id: "h1",
          ticker: "CASH",
          asset_class: "cash",
          quantity: 5000,
        }),
      ];
      const quotes = new Map<string, Quote>();
      const value = calculatePortfolioValue(holdings, quotes);
      expect(value).toBe(5000);
    });

    it("overrides any provided quote for cash with $1.00", () => {
      const holdings = [
        makeHolding({
          id: "h1",
          ticker: "CASH",
          asset_class: "cash",
          quantity: 3000,
        }),
      ];
      const quotes = new Map<string, Quote>([
        ["CASH", makeQuote({ ticker: "CASH", price: 99 })],
      ]);
      const value = calculatePortfolioValue(holdings, quotes);
      expect(value).toBe(3000);
    });

    it("handles mixed equity and cash portfolio", () => {
      const holdings = [
        makeHolding({ id: "h1", ticker: "VTI", quantity: 10 }),
        makeHolding({
          id: "h2",
          ticker: "CASH",
          asset_class: "cash",
          quantity: 2000,
        }),
      ];
      const quotes = new Map<string, Quote>([
        ["VTI", makeQuote({ ticker: "VTI", price: 240 })],
      ]);
      expect(calculatePortfolioValue(holdings, quotes)).toBe(4400);
    });
  });

  describe("calculateAllocationWeights", () => {
    it("computes correct weights for a simple portfolio", () => {
      const holdings = [
        makeHolding({
          id: "h1",
          ticker: "VTI",
          asset_class: "equity",
          quantity: 100,
        }),
        makeHolding({
          id: "h2",
          ticker: "BND",
          asset_class: "fixed_income",
          quantity: 50,
        }),
        makeHolding({
          id: "h3",
          ticker: "CASH",
          asset_class: "cash",
          quantity: 1000,
        }),
      ];
      const quotes = new Map<string, Quote>([
        ["VTI", makeQuote({ ticker: "VTI", price: 240 })],
        ["BND", makeQuote({ ticker: "BND", price: 72 })],
        ["CASH", makeQuote({ ticker: "CASH", price: 1.00 })],
      ]);

      const weights = calculateAllocationWeights(holdings, quotes);

      const equityW = weights.find((w) => w.asset_class === "equity")!;
      const fixedW = weights.find((w) => w.asset_class === "fixed_income")!;
      const cashW = weights.find((w) => w.asset_class === "cash")!;

      // VTI value: 100 * 240 = 24000
      // BND value: 50 * 72 = 3600
      // CASH value: 1000 * 1.00 = 1000
      // Total: 28600
      // Equity pct: 24000/28600 * 100 ≈ 83.92
      // Fixed pct: 3600/28600 * 100 ≈ 12.59
      // Cash pct: 1000/28600 * 100 ≈ 3.50
      expect(equityW.actual_pct).toBeCloseTo(83.92, 1);
      expect(fixedW.actual_pct).toBeCloseTo(12.59, 1);
      expect(cashW.actual_pct).toBeCloseTo(3.5, 1);
    });

    it("returns zero values for empty portfolio", () => {
      const weights = calculateAllocationWeights([], new Map());
      expect(weights.length).toBe(DEFAULT_TARGETS.length);
      for (const w of weights) {
        expect(w.actual_pct).toBe(0);
        expect(w.value_usd).toBe(0);
      }
    });
  });

  describe("detectDrift", () => {
    const makeWeight = (
      overrides: Partial<AllocationWeight> & { asset_class: string },
    ): AllocationWeight => ({
      asset_class: overrides.asset_class as AllocationWeight["asset_class"],
      target_pct: overrides.target_pct ?? 25,
      actual_pct: overrides.actual_pct ?? 25,
      drift_pct: overrides.drift_pct ?? 0,
      value_usd: overrides.value_usd ?? 1000,
    });

    it("detects overweight drift exceeding threshold", () => {
      const weights = [
        makeWeight({
          asset_class: "equity",
          target_pct: 30,
          actual_pct: 40,
          drift_pct: 10,
          value_usd: 4000,
        }),
      ];
      const drift = detectDrift(weights, 5);
      expect(drift).toHaveLength(1);
      expect(drift[0]!.asset_class).toBe("equity");
      expect(drift[0]!.direction).toBe("over");
    });

    it("detects underweight drift exceeding threshold", () => {
      const weights = [
        makeWeight({
          asset_class: "fixed_income",
          target_pct: 30,
          actual_pct: 20,
          drift_pct: -10,
          value_usd: 2000,
        }),
      ];
      const drift = detectDrift(weights, 5);
      expect(drift).toHaveLength(1);
      expect(drift[0]!.direction).toBe("under");
    });

    it("ignores drift below threshold", () => {
      const weights = [
        makeWeight({
          asset_class: "equity",
          target_pct: 30,
          actual_pct: 32,
          drift_pct: 2,
          value_usd: 3200,
        }),
      ];
      const drift = detectDrift(weights, 5);
      expect(drift).toHaveLength(0);
    });
  });

  describe("calculateHoldingWeights", () => {
    it("computes per-holding weight percentages", () => {
      const holdings = [
        makeHolding({ id: "h1", ticker: "VTI", quantity: 10 }),
        makeHolding({ id: "h2", ticker: "BND", quantity: 20 }),
      ];
      const quotes = new Map<string, Quote>([
        ["VTI", makeQuote({ ticker: "VTI", price: 240 })],
        ["BND", makeQuote({ ticker: "BND", price: 72 })],
      ]);
      // VTI: 2400, BND: 1440, total: 3840
      // VTI wt: 2400/3840 * 100 = 62.5
      // BND wt: 1440/3840 * 100 = 37.5
      const rows = calculateHoldingWeights(holdings, quotes);
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.ticker === "VTI")!.weight_pct).toBeCloseTo(
        62.5,
        1,
      );
      expect(rows.find((r) => r.ticker === "BND")!.weight_pct).toBeCloseTo(
        37.5,
        1,
      );
    });
  });
});
