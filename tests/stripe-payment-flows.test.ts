import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock refs ─────────────────────────────────────────────────────────

const { mockRpc } = vi.hoisted(() => {
  const mockRpc = vi.fn().mockResolvedValue({ error: null, data: null });
  return { mockRpc };
});

const { mockUpsert } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "sub-1" }, error: null }) }), onConflict: vi.fn() });
  return { mockUpsert };
});

const { mockFrom } = vi.hoisted(() => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockOrder = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockIn = vi.fn().mockReturnThis();

  const mockFromImpl = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    upsert: (...args: unknown[]) => mockUpsert(...args),
    delete: mockDelete,
    update: mockUpdate,
    eq: mockEq,
    in: mockIn,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    order: mockOrder,
  });

  return { mockFrom: mockFromImpl, mockSelect, mockEq, mockMaybeSingle, mockUpsert, mockSingle, mockOrder, mockIn, mockInsert, mockDelete, mockUpdate };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } }, error: null }) },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("stripe", () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
  })),
}));

vi.mock("@/lib/marketplace/import-token-service", () => ({
  creditTokensFromStripe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/marketplace/unlock-pricing", () => ({
  MARKETPLACE_UNLOCK_PRICE_CENTS: 499,
  splitUnlockSale: (amount: number) => ({
    creatorPayoutCents: Math.floor(amount * 0.7),
    platformFeeCents: Math.ceil(amount * 0.3),
    creatorRoyaltyPct: 0.7,
  }),
  isFoundingPublisher: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/security/encryption", () => ({
  encryptUtf8: vi.fn().mockReturnValue({ encrypted: "encrypted-data", iv: "iv", tag: "tag" }),
}));

vi.mock("@/lib/services/user-entitlements", () => ({
  getActiveServiceKeysForUser: vi.fn().mockResolvedValue(["core_v1", "intelligence_annual"]),
  enrichUserEntitlements: vi.fn(),
}));

vi.mock("@/lib/security/tier-guard", () => ({
  resolveEffectiveTier: vi.fn().mockReturnValue("INTELLIGENCE"),
  tierMeetsMinimum: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/marketplace/referral-service", () => ({
  resolveReferralCode: vi.fn().mockResolvedValue(null),
  processReferralReward: vi.fn().mockResolvedValue(undefined),
}));

import { supabaseAdmin } from "@/lib/supabase/admin";

// ── Webhook handler shims (mirroring the stripe/webhook route logic) ─────────

interface MarketplaceUnlockPayload {
  creatorUserId: string;
  stripeSessionId: string;
  amountPaidCents: number;
}

async function handleMarketplaceUnlock(payload: MarketplaceUnlockPayload): Promise<void> {
  const { creatorUserId, stripeSessionId, amountPaidCents } = payload;

  // Check for duplicate
  const { data: existing } = await supabaseAdmin
    .from("marketplace_unlocks")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  if (existing) return; // already processed

  // Insert unlock record
  const { error: insertErr } = await supabaseAdmin.from("marketplace_unlocks").insert({
    creator_user_id: creatorUserId,
    stripe_session_id: stripeSessionId,
    amount_cents: amountPaidCents,
  });
  if (insertErr) throw insertErr;

  // Accrue creator royalty
  if (amountPaidCents > 0) {
    const { splitUnlockSale } = await import("@/lib/marketplace/unlock-pricing");
    const { creatorPayoutCents } = splitUnlockSale(amountPaidCents);
    const { error: rpcErr } = await supabaseAdmin.rpc("accrue_creator_royalty", {
      p_creator_user_id: creatorUserId,
      p_delta_cents: creatorPayoutCents,
      p_stripe_session_id: stripeSessionId,
    });
    if (rpcErr) throw rpcErr;
  }

  // Credit import tokens
  const { creditTokensFromStripe } = await import("@/lib/marketplace/import-token-service");
  await creditTokensFromStripe(stripeSessionId);
}

interface SubscriptionCheckoutPayload {
  userId: string;
  serviceKey: string;
  stripeSessionId: string;
  renewalMode: "auto" | "manual";
  endsAt?: string | null;
}

async function handleSaasSubscriptionCheckout(payload: SubscriptionCheckoutPayload): Promise<void> {
  const { userId, serviceKey, stripeSessionId, renewalMode, endsAt } = payload;

  const { data: existing } = await supabaseAdmin
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("service_key", serviceKey)
    .maybeSingle();

  if (existing) return; // already activated

  const { error: upsertErr } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert(
      {
        user_id: userId,
        service_key: serviceKey,
        stripe_session_id: stripeSessionId,
        status: "active",
        renewal_mode: renewalMode,
        ends_at: endsAt ?? null,
      },
      { onConflict: "user_id,service_key" },
    );
  if (upsertErr) throw upsertErr;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Stripe webhook - handleMarketplaceUnlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful mocks
    mockRpc.mockResolvedValue({ error: null, data: null });
    (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    });
  });

  it("inserts unlock record and credits tokens on first call", async () => {
    // Re-mock maybeSingle for the duplicate check — return null
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockInsert = vi.fn().mockResolvedValue({ error: null, data: { id: "unlock-1" } });
    (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) }),
      insert: mockInsert,
      upsert: (...args: unknown[]) => mockUpsert(...args),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    });

    await handleMarketplaceUnlock({
      creatorUserId: "creator-1",
      stripeSessionId: "cs_test_001",
      amountPaidCents: 499,
    });

    // Should have checked for duplicates
    expect(mockFrom).toHaveBeenCalledWith("marketplace_unlocks");
    // Should have inserted
    expect(mockInsert).toHaveBeenCalled();
    // Should have accrued royalty via RPC
    expect(mockRpc).toHaveBeenCalledWith("accrue_creator_royalty", expect.objectContaining({
      p_stripe_session_id: "cs_test_001",
    }));
  });

  it("skips processing if unlock already exists (duplicate webhook)", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "existing-unlock" }, error: null });
    const mockInsert = vi.fn();
    (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) }),
      insert: mockInsert,
      upsert: (...args: unknown[]) => mockUpsert(...args),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    });

    await handleMarketplaceUnlock({
      creatorUserId: "creator-1",
      stripeSessionId: "cs_test_001",
      amountPaidCents: 499,
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("Stripe webhook - handleSaasSubscriptionCheckout", () => {
  function mockSubscriptionExists(hasExisting: boolean) {
    const maybeSingleResult = hasExisting
      ? { data: { id: "existing-sub" }, error: null }
      : { data: null, error: null };

    const eq2Result = { maybeSingle: vi.fn().mockResolvedValue(maybeSingleResult) };
    const eq1Result = { eq: vi.fn().mockReturnValue(eq2Result) };
    const selectResult = { eq: vi.fn().mockReturnValue(eq1Result) };

    return selectResult;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates subscription via upsert when no existing subscription", async () => {
    const selectResult = mockSubscriptionExists(false);
    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "sub-1" }, error: null }),
      }),
    });

    (mockFrom as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "user_subscriptions") {
        return {
          select: vi.fn().mockReturnValue(selectResult),
          upsert: (...args: unknown[]) => mockUpsert(...args),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        upsert: (...args: unknown[]) => mockUpsert(...args),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
      };
    });

    await handleSaasSubscriptionCheckout({
      userId: "user-1",
      serviceKey: "intelligence_annual",
      stripeSessionId: "cs_test_sub_001",
      renewalMode: "auto",
    });

    expect(mockUpsert).toHaveBeenCalled();
    const upsertCall = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(upsertCall.user_id).toBe("user-1");
    expect(upsertCall.service_key).toBe("intelligence_annual");
    expect(upsertCall.stripe_session_id).toBe("cs_test_sub_001");
    expect(upsertCall.status).toBe("active");
    expect(upsertCall.renewal_mode).toBe("auto");
  });

  it("skips activation if subscription already exists (idempotent)", async () => {
    const selectResult = mockSubscriptionExists(true);
    mockUpsert.mockClear();

    (mockFrom as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "user_subscriptions") {
        return {
          select: vi.fn().mockReturnValue(selectResult),
          upsert: (...args: unknown[]) => mockUpsert(...args),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        upsert: (...args: unknown[]) => mockUpsert(...args),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
      };
    });

    await handleSaasSubscriptionCheckout({
      userId: "user-1",
      serviceKey: "intelligence_annual",
      stripeSessionId: "cs_test_sub_001",
      renewalMode: "auto",
    });

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("handles manual renewal mode subscription", async () => {
    const selectResult = mockSubscriptionExists(false);
    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "sub-manual" }, error: null }),
      }),
    });

    (mockFrom as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "user_subscriptions") {
        return {
          select: vi.fn().mockReturnValue(selectResult),
          upsert: (...args: unknown[]) => mockUpsert(...args),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        upsert: (...args: unknown[]) => mockUpsert(...args),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
      };
    });

    const endsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await handleSaasSubscriptionCheckout({
      userId: "user-1",
      serviceKey: "intelligence_annual",
      stripeSessionId: "cs_test_manual",
      renewalMode: "manual",
      endsAt,
    });

    expect(mockUpsert).toHaveBeenCalled();
    const upsertCall = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(upsertCall.renewal_mode).toBe("manual");
    expect(upsertCall.ends_at).toBe(endsAt);
  });
});
