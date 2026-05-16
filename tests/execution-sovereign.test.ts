import { describe, expect, test, afterEach } from "vitest";
import { isLiveExecutionMode } from "@/lib/execution/execution-config";
import { dispatchOrder } from "@/lib/execution/registry";
import { classifyExecutionErrorCode } from "@/lib/execution/error-code-taxonomy";
import {
  MARKETPLACE_UNLOCK_PRICE_CENTS,
  splitUnlockSale,
  CREATOR_ROYALTY_NUMERATOR,
} from "@/lib/marketplace/unlock-pricing";
import { isExecutionPortfolioProvider } from "@/lib/portfolio/api-credentials-shared";
import fs from "node:fs";
import path from "node:path";

describe("execution stub mode default", () => {
  const prev = process.env.EXECUTION_LIVE_MODE;

  afterEach(() => {
    if (prev === undefined) delete process.env.EXECUTION_LIVE_MODE;
    else process.env.EXECUTION_LIVE_MODE = prev;
  });

  test("isLiveExecutionMode is false unless exactly true", () => {
    delete process.env.EXECUTION_LIVE_MODE;
    expect(isLiveExecutionMode()).toBe(false);
    process.env.EXECUTION_LIVE_MODE = "false";
    expect(isLiveExecutionMode()).toBe(false);
    process.env.EXECUTION_LIVE_MODE = "1";
    expect(isLiveExecutionMode()).toBe(false);
  });

  test("dispatchOrder returns stub when live mode off", async () => {
    process.env.EXECUTION_LIVE_MODE = "false";
    const result = await dispatchOrder(
      "alpaca",
      { ticker: "SPY", side: "buy", quantity: "1" },
      "key",
      "secret",
    );
    expect(result.ok).toBe(true);
    expect(result.stub).toBe(true);
    expect(result.externalId).toMatch(/^alpaca-stub-/);
  });
});

describe("circuit breaker error taxonomy", () => {
  test("hard vs soft classification", () => {
    expect(classifyExecutionErrorCode("BALANCE_INSUFFICIENT")).toBe("HARD");
    expect(classifyExecutionErrorCode("INVALID_API_KEY")).toBe("HARD");
    expect(classifyExecutionErrorCode("NETWORK_TIMEOUT")).toBe("SOFT");
    expect(classifyExecutionErrorCode("RATE_LIMIT_EXCEEDED")).toBe("SOFT");
    expect(classifyExecutionErrorCode("ALPACA_HTTP_500")).toBe("HARD");
  });

});

describe("marketplace unlock pricing", () => {
  test("unlock price is $4.99 (499 cents)", () => {
    expect(MARKETPLACE_UNLOCK_PRICE_CENTS).toBe(499);
  });

  test("70/30 royalty split on $4.99", () => {
    const { creatorPayoutCents, platformFeeCents, creatorRoyaltyPct } = splitUnlockSale(499);
    expect(creatorRoyaltyPct).toBe(CREATOR_ROYALTY_NUMERATOR / 100);
    expect(creatorPayoutCents).toBe(Math.floor((499 * 70) / 100));
    expect(platformFeeCents).toBe(499 - creatorPayoutCents);
  });

  test("stripe webhook idempotency key is session id (documented contract)", () => {
    const webhookSrc = fs.readFileSync(
      path.join(process.cwd(), "app/api/stripe/webhook/route.ts"),
      "utf8",
    );
    expect(webhookSrc).toContain('eq("stripe_session_id", sessionId)');
    expect(webhookSrc).toContain("duplicate: true");
  });
});

describe("portfolio execution provider boundary", () => {
  test("tiingo is not an execution provider", () => {
    expect(isExecutionPortfolioProvider("tiingo")).toBe(false);
    expect(isExecutionPortfolioProvider("alpaca")).toBe(true);
  });
});

describe("marketplace_leaderboard_public view", () => {
  test("view omits blueprint_json and metadata", () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260616130000_marketplace_rls_blueprint_audit.sql"),
      "utf8",
    );
    const selectMatch = sql.match(
      /CREATE OR REPLACE VIEW public\.marketplace_leaderboard_public[\s\S]*?AS\s+SELECT([\s\S]*?)FROM public\.marketplace_strategies/,
    );
    expect(selectMatch).toBeTruthy();
    const selectList = selectMatch![1]!;
    expect(selectList).not.toMatch(/\bblueprint_json\b/);
    expect(selectList).not.toMatch(/\bmetadata\b/);
    expect(selectList).toContain("display_name");
    expect(selectList).toContain("strategy_grade");
    const tierSql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260617120000_tier_core_circuit_breaker_v2.sql"),
      "utf8",
    );
    expect(tierSql).toContain("GRANT SELECT ON public.marketplace_leaderboard_public TO anon");
  });
});
