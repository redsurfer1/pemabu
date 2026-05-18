import { describe, expect, it } from "vitest";
import { errorMessageFromResponseBody, getErrorMessage } from "./error-message";

describe("getErrorMessage", () => {
  it("returns strings as-is", () => {
    expect(getErrorMessage("Bad request")).toBe("Bad request");
  });

  it("extracts message from Error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("extracts message from supabase-style objects", () => {
    expect(getErrorMessage({ message: "column missing", code: "42703" })).toBe("column missing");
  });

  it("formats zod flatten objects instead of [object Object]", () => {
    const flat = {
      formErrors: ["Invalid input"],
      fieldErrors: { ticker: ["Required"] },
    };
    expect(getErrorMessage(flat)).toBe("Invalid input; ticker: Required");
  });

  it("avoids [object Object] for plain Error constructed with object", () => {
    expect(new Error({ nested: true } as unknown as string).message).toBe("[object Object]");
    expect(getErrorMessage({ nested: true })).not.toBe("[object Object]");
  });
});

describe("errorMessageFromResponseBody", () => {
  it("reads nested error field", () => {
    expect(
      errorMessageFromResponseBody(
        { error: { formErrors: [], fieldErrors: { portfolioId: ["Invalid uuid"] } } },
        "fallback",
      ),
    ).toBe("portfolioId: Invalid uuid");
  });
});
