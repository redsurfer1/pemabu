import { describe, expect, test, vi, beforeEach } from "vitest";

const { mockFrom, creditTokensFromStripe } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  creditTokensFromStripe: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock("@/lib/marketplace/import-token-service", () => ({
  creditTokensFromStripe,
}));

import { resolveReferralCode, processReferralReward } from "@/lib/marketplace/referral-service";

function chain(result: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const c: Record<string, unknown> = {};
  const terminal = () => Promise.resolve(result);
  for (const m of ["select", "eq", "maybeSingle", "single", "insert", "update"]) {
    c[m] = vi.fn(() => c);
  }
  c.maybeSingle = terminal;
  c.single = terminal;
  c.insert = terminal;
  c.update = terminal;
  return c;
}

describe("referral-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("resolveReferralCode returns user id when found", async () => {
    mockFrom.mockReturnValue(chain({ data: { user_id: "user-abc" }, error: null }));
    await expect(resolveReferralCode("pemabu-abcd12")).resolves.toBe("user-abc");
  });

  test("processReferralReward rejects self-referral", async () => {
    const result = await processReferralReward({
      referrerUserId: "same",
      refereeUserId: "same",
      stripeSessionId: "sess_1",
    });
    expect(result.rewarded).toBe(false);
    expect(result.reason).toBe("self_referral");
    expect(creditTokensFromStripe).not.toHaveBeenCalled();
  });
});
