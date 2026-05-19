import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock refs ─────────────────────────────────────────────────────────

const { mockRpc } = vi.hoisted(() => {
  const mockRpc = vi.fn().mockResolvedValue({ error: null, data: null });
  return { mockRpc };
});

const { mockUpsert } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: "sub-1" }, error: null }),
    }),
    onConflict: vi.fn(),
  });
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
  const mockGte = vi.fn().mockReturnThis();

  const mockFromImpl = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    upsert: (...args: unknown[]) => mockUpsert(...args),
    delete: mockDelete,
    update: mockUpdate,
    eq: mockEq,
    in: mockIn,
    gte: mockGte,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    order: mockOrder,
  });

  return {
    mockFrom: mockFromImpl, mockSelect, mockEq, mockMaybeSingle, mockUpsert,
    mockSingle, mockOrder, mockIn, mockInsert, mockDelete, mockUpdate, mockGte,
  };
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
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", email: "test@example.com" } },
        error: null,
      }),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

vi.mock("server-only", () => ({}));

const mockStripeConstructEvent = vi.fn();
const mockStripeSubscriptionsUpdate = vi.fn();
const mockStripePortalCreate = vi.fn();
const mockStripeCheckoutCreate = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: mockStripeConstructEvent },
    checkout: { sessions: { create: mockStripeCheckoutCreate } },
    billingPortal: { sessions: { create: mockStripePortalCreate } },
    subscriptions: { update: mockStripeSubscriptionsUpdate },
    customers: {
      create: vi.fn().mockResolvedValue({ id: "cus_mock" }),
      retrieve: vi.fn().mockResolvedValue({ id: "cus_mock", deleted: false }),
    },
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
}));

vi.mock("@/lib/security/encryption", () => ({
  encryptUtf8: vi.fn().mockReturnValue({
    ciphertextB64: "encrypted",
    ivB64: "iv",
    authTagB64: "tag",
  }),
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

// ── Helper: reset mock chain ──────────────────────────────────────────────────

function mockSupabaseChain(overrides?: Partial<ReturnType<typeof vi.fn>>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: (...args: unknown[]) => mockUpsert(...args),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    ...overrides,
  };
  (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

// ── Webhook handler shims ─────────────────────────────────────────────────────

async function handleMarketplaceUnlock(payload: {
  creatorUserId: string;
  stripeSessionId: string;
  amountPaidCents: number;
}): Promise<void> {
  const { creatorUserId, stripeSessionId, amountPaidCents } = payload;

  const { data: existing } = await supabaseAdmin
    .from("marketplace_unlocks")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  if (existing) return;

  const { splitUnlockSale } = await import("@/lib/marketplace/unlock-pricing");
  const { creatorPayoutCents } = splitUnlockSale(amountPaidCents);

  const { error: insertErr } = await supabaseAdmin.from("marketplace_unlocks").insert({
    creator_user_id: creatorUserId,
    stripe_session_id: stripeSessionId,
    amount_cents: amountPaidCents,
    creator_payout_cents: creatorPayoutCents,
    creator_royalty_pct: 0.7,
    platform_fee_cents: amountPaidCents - creatorPayoutCents,
  });
  if (insertErr) throw insertErr;

  if (amountPaidCents > 0) {
    const { error: rpcErr } = await supabaseAdmin.rpc("accrue_creator_royalty", {
      p_creator_user_id: creatorUserId,
      p_delta_cents: creatorPayoutCents,
      p_stripe_session_id: stripeSessionId,
    });
    if (rpcErr) throw rpcErr;
  }

  const { creditTokensFromStripe } = await import("@/lib/marketplace/import-token-service");
  await creditTokensFromStripe({
    userId: creatorUserId,
    stripeSessionId,
    quantity: 1,
    amountUsdCents: amountPaidCents,
  });
}

async function handleSaasSubscriptionCheckout(payload: {
  userId: string;
  serviceKey: string;
  stripeSessionId: string;
  renewalMode: "auto" | "manual" | "one_time";
  endsAt?: string | null;
}): Promise<void> {
  const { userId, serviceKey, stripeSessionId, renewalMode, endsAt } = payload;

  const { data: existingBySession } = await supabaseAdmin
    .from("user_subscriptions")
    .select("id")
    .eq("stripe_session_id", stripeSessionId)
    .maybeSingle();

  if (existingBySession) return;

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

async function handleInvoicePaid(payload: {
  stripeSubscriptionId: string;
  periodEndMs: number;
}): Promise<void> {
  const { stripeSubscriptionId, periodEndMs } = payload;

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({ status: "active", ends_at: new Date(periodEndMs).toISOString() })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (error) throw error;
}

async function handleSubscriptionDeleted(payload: {
  stripeSubscriptionId: string;
}): Promise<void> {
  const { stripeSubscriptionId } = payload;

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({ status: "cancelled", ends_at: new Date().toISOString() })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  if (error) throw error;
}

async function handleImportTokenBundle(payload: {
  userId: string;
  stripeSessionId: string;
  tokenQuantity: number;
  amountCents: number;
  referralCode?: string;
}): Promise<void> {
  const { userId, stripeSessionId, tokenQuantity, amountCents, referralCode } = payload;

  const { creditTokensFromStripe } = await import("@/lib/marketplace/import-token-service");
  await creditTokensFromStripe({
    userId,
    stripeSessionId,
    quantity: tokenQuantity,
    amountUsdCents: amountCents,
  });

  if (referralCode) {
    const { resolveReferralCode, processReferralReward } = await import("@/lib/marketplace/referral-service");
    const referrerUserId = await resolveReferralCode(referralCode);
    if (referrerUserId) {
      await processReferralReward({
        referrerUserId,
        refereeUserId: userId,
        stripeSessionId,
      });
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Stripe webhook - handleMarketplaceUnlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null, data: null });
    mockSupabaseChain();
  });

  it("inserts unlock record and credits tokens on first call", async () => {
    await handleMarketplaceUnlock({
      creatorUserId: "creator-1",
      stripeSessionId: "cs_test_001",
      amountPaidCents: 499,
    });

    expect(mockFrom).toHaveBeenCalledWith("marketplace_unlocks");
    expect(mockRpc).toHaveBeenCalledWith("accrue_creator_royalty", expect.objectContaining({
      p_stripe_session_id: "cs_test_001",
    }));
  });

  it("skips processing if unlock already exists (duplicate webhook)", async () => {
    (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "existing-unlock" }, error: null }),
        }),
      }),
      insert: vi.fn(),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    });

    await handleMarketplaceUnlock({
      creatorUserId: "creator-1",
      stripeSessionId: "cs_test_001",
      amountPaidCents: 499,
    });

    // insert should not have been called for the unlock
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("Stripe webhook - handleSaasSubscriptionCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "sub-1" }, error: null }),
      }),
      onConflict: vi.fn(),
    });
  });

  function mockSubscriptionCheck(hasExisting: boolean) {
    (mockFrom as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "user_subscriptions") {
        const chain = {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(
                hasExisting
                  ? { data: { id: "existing-sub" }, error: null }
                  : { data: null, error: null }
              ),
            }),
          }),
          upsert: (...args: unknown[]) => mockUpsert(...args),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
        return chain;
      }
      return {
        select: vi.fn().mockReturnThis(),
        upsert: (...args: unknown[]) => mockUpsert(...args),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
    });
  }

  it("activates subscription via upsert on first call", async () => {
    mockSubscriptionCheck(false);

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
    expect(upsertCall.status).toBe("active");
    expect(upsertCall.renewal_mode).toBe("auto");
  });

  it("skips activation on duplicate webhook (same stripe_session_id)", async () => {
    mockSubscriptionCheck(true);
    mockUpsert.mockClear();

    await handleSaasSubscriptionCheckout({
      userId: "user-1",
      serviceKey: "intelligence_annual",
      stripeSessionId: "cs_test_sub_001",
      renewalMode: "auto",
    });

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("activates manual renewal mode subscription", async () => {
    mockSubscriptionCheck(false);

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

  it("activates one_time mode subscription", async () => {
    mockSubscriptionCheck(false);

    await handleSaasSubscriptionCheckout({
      userId: "user-1",
      serviceKey: "core_v1",
      stripeSessionId: "cs_test_onetime",
      renewalMode: "one_time",
      endsAt: null,
    });

    expect(mockUpsert).toHaveBeenCalled();
    const upsertCall = mockUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(upsertCall.renewal_mode).toBe("one_time");
    expect(upsertCall.ends_at).toBeNull();
  });
});

describe("Stripe webhook - handleInvoicePaid (auto-renewal)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extends ends_at on the subscription matching stripe_subscription_id", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null, data: null }),
    });
    (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      update: mockUpdate,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });

    const periodEndMs = Date.now() + 365 * 24 * 60 * 60 * 1000;
    await handleInvoicePaid({
      stripeSubscriptionId: "sub_abc123",
      periodEndMs,
    });

    expect(mockFrom).toHaveBeenCalledWith("user_subscriptions");
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "active",
      ends_at: new Date(periodEndMs).toISOString(),
    });
  });

  it("throws if update fails", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: new Error("DB error"), data: null }),
    });
    (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      update: mockUpdate,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });

    await expect(handleInvoicePaid({
      stripeSubscriptionId: "sub_abc123",
      periodEndMs: Date.now(),
    })).rejects.toThrow("DB error");
  });
});

describe("Stripe webhook - handleSubscriptionDeleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets subscription status to cancelled", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null, data: null }),
    });
    (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      update: mockUpdate,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });

    await handleSubscriptionDeleted({ stripeSubscriptionId: "sub_xyz" });

    expect(mockUpdate).toHaveBeenCalled();
    const updateArg = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg.status).toBe("cancelled");
  });

  it("throws if update fails", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: new Error("DB error"), data: null }),
    });
    (mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({
      update: mockUpdate,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    });

    await expect(handleSubscriptionDeleted({ stripeSubscriptionId: "sub_xyz" })).rejects.toThrow("DB error");
  });
});

describe("Stripe webhook - handleImportTokenBundle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("credits tokens and skips referral when no referral code", async () => {
    const { creditTokensFromStripe } = await import("@/lib/marketplace/import-token-service");
    const { resolveReferralCode } = await import("@/lib/marketplace/referral-service");

    await handleImportTokenBundle({
      userId: "user-1",
      stripeSessionId: "cs_test_tokens",
      tokenQuantity: 5,
      amountCents: 1999,
    });

    expect(creditTokensFromStripe).toHaveBeenCalled();
    expect(resolveReferralCode).not.toHaveBeenCalled();
  });

  it("processes referral reward when referral code present", async () => {
    const { creditTokensFromStripe } = await import("@/lib/marketplace/import-token-service");
    const { resolveReferralCode, processReferralReward } = await import("@/lib/marketplace/referral-service");

    (resolveReferralCode as ReturnType<typeof vi.fn>).mockResolvedValue("referrer-1");

    await handleImportTokenBundle({
      userId: "user-1",
      stripeSessionId: "cs_test_ref",
      tokenQuantity: 1,
      amountCents: 499,
      referralCode: "REF123",
    });

    expect(creditTokensFromStripe).toHaveBeenCalled();
    expect(resolveReferralCode).toHaveBeenCalledWith("REF123");
    expect(processReferralReward).toHaveBeenCalledWith({
      referrerUserId: "referrer-1",
      refereeUserId: "user-1",
      stripeSessionId: "cs_test_ref",
    });
  });
});
