import { describe, expect, it } from "vitest";
import {
  computeThirteenFSentiment,
  parseSharesFrom13FXml,
} from "./thirteen-f-edgar";

describe("computeThirteenFSentiment", () => {
  it("marks new positions as accumulating", () => {
    expect(computeThirteenFSentiment(750, null)).toBe("accumulating");
    expect(computeThirteenFSentiment(100, 0)).toBe("accumulating");
  });

  it("marks exits as no position", () => {
    expect(computeThirteenFSentiment(0, 500)).toBe("no_position");
    expect(computeThirteenFSentiment(null, 100)).toBe("no_position");
  });

  it("compares share changes", () => {
    expect(computeThirteenFSentiment(800, 750)).toBe("accumulating");
    expect(computeThirteenFSentiment(750, 750)).toBe("holding");
    expect(computeThirteenFSentiment(600, 750)).toBe("decreasing");
  });
});

describe("parseSharesFrom13FXml", () => {
  const sample = `
    <infoTable>
      <titleOfClass>FBTC</titleOfClass>
      <shrsOrPrnAmt><sshPrnamt>750</sshPrnamt></shrsOrPrnAmt>
    </infoTable>
    <infoTable>
      <titleOfClass>AAPL</titleOfClass>
      <shrsOrPrnAmt><sshPrnamt>100</sshPrnamt></shrsOrPrnAmt>
    </infoTable>
  `;

  it("extracts shares for matching titleOfClass", () => {
    expect(parseSharesFrom13FXml(sample, "FBTC")).toBe(750);
    expect(parseSharesFrom13FXml(sample, "AAPL")).toBe(100);
    expect(parseSharesFrom13FXml(sample, "MSFT")).toBeNull();
  });
});
