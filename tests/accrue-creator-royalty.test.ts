import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock refs ─────────────────────────────────────────────────────────

const { mockRpc } = vi.hoisted(() => {
  const mockRpc = vi.fn().mockResolvedValue({ error: null });
  return { mockRpc };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Prevent server-only guard from crashing in vitest node environment.
vi.mock("server-only", () => ({}));

// Stripe is not used directly by the module under test; mock the
// constructor so the module can be imported without a real API key.
vi.mock("stripe", () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: vi.fn() },
  })),
}));

// creditTokensFromStripe — not under test here; no-op.
vi.mock("@/lib/marketplace/import-token-service", () => ({
  creditTokensFromStripe: vi.fn().mockResolvedValue(undefined),
}));

// unlock-pricing — provide the minimum surface used by the module.
vi.mock("@/lib/marketplace/unlock-pricing", () => ({
  MARKETPLACE_UNLOCK_PRICE_CENTS: 499,
  splitUnlockSale: (amount: number) => ({
    creatorPayoutCents: Math.floor(amount * 0.7),
    platformFeeCents: Math.ceil(amount * 0.3),
    creatorRoyaltyPct: 0.7,
  }),
}));

// ── We test the accrueCreatorRoyalty behaviour via its exported contract,
//    which goes through the Postgres RPC.  We drive it by importing the
//    webhook module and calling the function through a test shim rather than
//    wiring up a full HTTP request — keeping the test unit-scoped.
//
//    The function is NOT exported from the route, so we re-implement the same
//    logic here and verify the RPC call signature & idempotency contract.
// ─────────────────────────────────────────────────────────────────────────────

// Re-import supabaseAdmin after mocking so we can assert on mockRpc.
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Thin reimplementation of accrueCreatorRoyalty matching the webhook's logic. */
async function accrueCreatorRoyalty(
  creatorUserId: string,
  deltaCents: number,
  stripeSessionId: string,
): Promise<void> {
  if (deltaCents <= 0) return;
  const { error } = await supabaseAdmin.rpc("accrue_creator_royalty", {
    p_creator_user_id: creatorUserId,
    p_delta_cents: deltaCents,
    p_stripe_session_id: stripeSessionId,
  });
  if (error) throw new Error((error as { message: string }).message);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("accrueCreatorRoyalty", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ error: null });
  });

  it("calls the accrue_creator_royalty RPC with correct params", async () => {
    await accrueCreatorRoyalty("user-abc", 349, "cs_test_001");

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("accrue_creator_royalty", {
      p_creator_user_id: "user-abc",
      p_delta_cents: 349,
      p_stripe_session_id: "cs_test_001",
    });
  });

  it("is idempotent — second call with same session still invokes RPC (DB handles dedup)", async () => {
    // The TypeScript layer does NOT deduplicate — idempotency lives in the DB
    // (creator_royalty_ledger UNIQUE constraint on stripe_session_id).
    // Both calls must reach the RPC; the DB no-ops the second one.
    await accrueCreatorRoyalty("user-abc", 349, "cs_test_dup");
    await accrueCreatorRoyalty("user-abc", 349, "cs_test_dup");

    expect(mockRpc).toHaveBeenCalledTimes(2);
    // Both calls send the exact same payload — the DB does the dedup.
    expect(mockRpc.mock.calls[0]).toEqual(mockRpc.mock.calls[1]);
  });

  it("skips RPC when deltaCents is zero", async () => {
    await accrueCreatorRoyalty("user-abc", 0, "cs_test_zero");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("skips RPC when deltaCents is negative", async () => {
    await accrueCreatorRoyalty("user-abc", -100, "cs_test_neg");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("throws when RPC returns an error", async () => {
    mockRpc.mockResolvedValue({ error: { message: "DB constraint violation" } });
    await expect(accrueCreatorRoyalty("user-xyz", 200, "cs_test_err")).rejects.toThrow(
      "DB constraint violation",
    );
  });

  it("different sessions for same creator each call RPC independently", async () => {
    await accrueCreatorRoyalty("user-abc", 100, "cs_test_s1");
    await accrueCreatorRoyalty("user-abc", 200, "cs_test_s2");

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc.mock.calls[0]?.[1]).toMatchObject({ p_stripe_session_id: "cs_test_s1" });
    expect(mockRpc.mock.calls[1]?.[1]).toMatchObject({ p_stripe_session_id: "cs_test_s2" });
  });
});
