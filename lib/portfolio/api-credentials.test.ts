import { describe, expect, test } from "vitest";
import { maskApiKey, providerRequiresSecret } from "@/lib/portfolio/api-credentials";

describe("portfolio api credentials", () => {
  test("maskApiKey shows last four characters", () => {
    expect(maskApiKey("abcdefghijklmnop")).toBe("••••mnop");
    expect(maskApiKey("ab")).toBe("••••");
  });

  test("providerRequiresSecret", () => {
    expect(providerRequiresSecret("tiingo")).toBe(false);
    expect(providerRequiresSecret("alpaca")).toBe(true);
  });
});
