import { describe, expect, it } from "vitest";
import {
  enrichDisclosuresWithSentiment,
  parseAmountMidpoint,
  transactionExposureDelta,
} from "./disclosure-sentiment";

const base = {
  party: "D" as const,
  state: "CA" as const,
  asset_description: null,
  filed_at_date: null,
};

describe("parseAmountMidpoint", () => {
  it("parses range strings", () => {
    expect(parseAmountMidpoint("$1,001 - $15,000")).toBe(8000.5);
  });
});

describe("transactionExposureDelta", () => {
  it("signs purchases and sales", () => {
    expect(transactionExposureDelta("purchase", 5000)).toBe(5000);
    expect(transactionExposureDelta("Sale", 5000)).toBe(-5000);
  });
});

describe("enrichDisclosuresWithSentiment", () => {
  it("marks purchase after flat period as accumulating", () => {
    const rows = enrichDisclosuresWithSentiment([
      {
        ...base,
        id: "1",
        representative: "Rep A",
        ticker: "NVDA",
        transaction_type: "purchase",
        amount_range: "$1,001 - $15,000",
        transaction_date: "2026-01-10",
      },
    ]);
    expect(rows[0]?.sentiment).toBe("accumulating");
  });

  it("marks sale after purchases as decreasing", () => {
    const history = [
      {
        ...base,
        id: "1",
        representative: "Rep A",
        ticker: "NVDA",
        transaction_type: "purchase",
        amount_range: "$15,001 - $50,000",
        transaction_date: "2026-01-01",
      },
      {
        ...base,
        id: "2",
        representative: "Rep A",
        ticker: "NVDA",
        transaction_type: "sale",
        amount_range: "$1,001 - $15,000",
        transaction_date: "2026-02-01",
      },
    ];
    const rows = enrichDisclosuresWithSentiment(history);
    expect(rows[1]?.sentiment).toBe("decreasing");
  });
});
