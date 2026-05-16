import { describe, expect, test } from "vitest";
import {
  isExecutionPortfolioProvider,
  maskApiKey,
  providerRequiresSecret,
} from "@/lib/portfolio/api-credentials-shared";
import { splitUnlockSale, MARKETPLACE_UNLOCK_PRICE_CENTS } from "@/lib/marketplace/unlock-pricing";

describe("portfolio api credentials", () => {
  test("maskApiKey shows last four characters", () => {
    expect(maskApiKey("abcdefghijklmnop")).toBe("••••mnop");
    expect(maskApiKey("ab")).toBe("••••");
  });

  test("providerRequiresSecret", () => {
    expect(providerRequiresSecret("tiingo")).toBe(false);
    expect(providerRequiresSecret("alpaca")).toBe(true);
  });

  test("execution providers require vault", () => {
    expect(isExecutionPortfolioProvider("kraken")).toBe(true);
    expect(isExecutionPortfolioProvider("tiingo")).toBe(false);
  });

  test("marketplace unlock at $4.99", () => {
    expect(MARKETPLACE_UNLOCK_PRICE_CENTS).toBe(499);
    expect(splitUnlockSale(499).creatorPayoutCents).toBe(349);
  });
});
