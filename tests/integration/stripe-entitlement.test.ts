import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const { mockConstructEvent, mockFrom, mockRpc } = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  const mockFrom = vi.fn();
  const mockRpc = vi.fn().mockResolvedValue({ error: null, data: null });
  return { mockConstructEvent, mockFrom, mockRpc };
});

vi.mock("stripe", () => ({
  default: vi.fn(function () {
    return { webhooks: { constructEvent: mockConstructEvent } };
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/lib/marketplace/unlock-pricing", () => ({
  MARKETPLACE_UNLOCK_PRICE_CENTS: 499,
  splitUnlockSale: () => ({
    creatorPayoutCents: 349,
    platformFeeCents: 150,
    creatorRoyaltyPct: 0.7,
  }),
}));

vi.mock("@/lib/marketplace/import-token-service", () => ({
  creditTokensFromStripe: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/marketplace/referral-service", () => ({
  resolveReferralCode: vi.fn().mockResolvedValue(null),
  processReferralReward: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  setTag: vi.fn(),
}));

function mockSupabaseChain(overrides?: Record<string, unknown>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null, data: null }),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null, data: null }),
    }),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    onConflict: vi.fn(),
    ...overrides,
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

import { POST } from "@/app/api/stripe/webhook/route";

function createWebhookEvent(overrides: Record<string, unknown>) {
  mockConstructEvent.mockReturnValue({
    type: overrides.type ?? "checkout.session.completed",
    data: { object: overrides.data ?? {} },
  });
}

function createPostRequest(): Request {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "stripe-signature": "t=123,v1=fakesig" },
  });
}

describe("Stripe webhook → entitlement flow", () => {
  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseChain();
    mockRpc.mockResolvedValue({ error: null, data: null });
  });

  describe("checkout.session.completed — saas_subscription", () => {
    it("creates user_subscriptions via upsert on first call", async () => {
      const upsertMock = vi
        .fn()
        .mockResolvedValue({ error: null, data: null });
      mockSupabaseChain({ upsert: upsertMock });

      createWebhookEvent({
        type: "checkout.session.completed",
        data: {
          id: "cs_test_sub_001",
          metadata: {
            type: "saas_subscription",
            user_id: "user-1",
            service_key: "intelligence_annual",
            renewal_mode: "auto",
          },
          mode: "payment",
          customer: null,
          amount_total: 9999,
          payment_status: "paid",
        },
      });

      const res = await createPostRequest();
      const response = await POST(res);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ received: true });
      expect(upsertMock).toHaveBeenCalledTimes(1);
      const upsertArg = upsertMock.mock
        .calls[0]?.[0] as Record<string, unknown>;
      expect(upsertArg.user_id).toBe("user-1");
      expect(upsertArg.service_key).toBe("intelligence_annual");
      expect(upsertArg.status).toBe("active");
      expect(upsertArg.renewal_mode).toBe("auto");
    });

    it("skips duplicate webhook for same stripe_session_id", async () => {
      const upsertMock = vi
        .fn()
        .mockResolvedValue({ error: null, data: null });
      mockSupabaseChain({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({
              data: { id: "existing-sub" },
              error: null,
            }),
        }),
        upsert: upsertMock,
      });

      createWebhookEvent({
        type: "checkout.session.completed",
        data: {
          id: "cs_test_sub_001",
          metadata: {
            type: "saas_subscription",
            user_id: "user-1",
            service_key: "intelligence_annual",
            renewal_mode: "auto",
          },
          mode: "payment",
          customer: null,
          amount_total: 9999,
          payment_status: "paid",
        },
      });

      const res = await createPostRequest();
      const response = await POST(res);

      expect(response.status).toBe(200);
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("activates one_time mode subscription (perpetual, ends_at = null)", async () => {
      const upsertMock = vi
        .fn()
        .mockResolvedValue({ error: null, data: null });
      mockSupabaseChain({ upsert: upsertMock });

      createWebhookEvent({
        type: "checkout.session.completed",
        data: {
          id: "cs_test_onetime",
          metadata: {
            type: "saas_subscription",
            user_id: "user-2",
            service_key: "core_v1",
            renewal_mode: "one_time",
          },
          mode: "payment",
          customer: null,
          amount_total: 4999,
          payment_status: "paid",
        },
      });

      await POST(createPostRequest());

      expect(upsertMock).toHaveBeenCalledTimes(1);
      const arg = upsertMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(arg.renewal_mode).toBe("one_time");
      expect(arg.ends_at).toBeNull();
    });
  });

  describe("customer.subscription.deleted", () => {
    it("sets status to cancelled", async () => {
      const eqMock = vi
        .fn()
        .mockResolvedValue({ error: null, data: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseChain({ update: updateMock });

      createWebhookEvent({
        type: "customer.subscription.deleted",
        data: {
          id: "sub_xyz",
        },
      });

      const response = await POST(createPostRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ received: true });
      expect(updateMock).toHaveBeenCalledTimes(1);
      const updateArg = updateMock.mock
        .calls[0]?.[0] as Record<string, unknown>;
      expect(updateArg.status).toBe("cancelled");
      expect(eqMock).toHaveBeenCalledWith(
        "stripe_subscription_id",
        "sub_xyz",
      );
    });
  });

  describe("invoice.paid", () => {
    it("extends ends_at on the matching subscription", async () => {
      const eqMock = vi
        .fn()
        .mockResolvedValue({ error: null, data: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseChain({ update: updateMock });

      const periodEnd = Math.floor(Date.now() / 1000) + 31536000;

      createWebhookEvent({
        type: "invoice.paid",
        data: {
          subscription: "sub_abc",
          period_end: periodEnd,
        },
      });

      const response = await POST(createPostRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ received: true });
      expect(updateMock).toHaveBeenCalledWith({
        status: "active",
        ends_at: new Date(periodEnd * 1000).toISOString(),
      });
      expect(eqMock).toHaveBeenCalledWith(
        "stripe_subscription_id",
        "sub_abc",
      );
    });

    it("returns 500 when update fails", async () => {
      const eqMock = vi
        .fn()
        .mockResolvedValue({
          error: new Error("DB error"),
          data: null,
        });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseChain({ update: updateMock });

      createWebhookEvent({
        type: "invoice.paid",
        data: {
          subscription: "sub_fail",
          period_end: Math.floor(Date.now() / 1000),
        },
      });

      const response = await POST(createPostRequest());
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toMatchObject({ error: "DB error" });
    });
  });

  describe("getActiveServiceKeysForUser — entitlement resolution", () => {
    it("returns service keys for active subscriptions only", async () => {
      const subscriptionsData = [
        { service_key: "core_v1", status: "active" },
        {
          service_key: "intelligence_annual",
          status: "cancelled",
        },
        { service_key: "autonomous_annual", status: "active" },
      ];
      const subEq = vi
        .fn()
        .mockResolvedValue({ data: subscriptionsData, error: null });
      const groupEq = vi.fn().mockReturnValue({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: null, error: null }),
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === "user_subscriptions") {
          return {
            select: vi.fn().mockReturnValue({ eq: subEq }),
            upsert: vi.fn().mockResolvedValue({ error: null, data: null }),
          };
        }
        if (table === "user_group_assignments") {
          return {
            select: vi.fn().mockReturnValue({ eq: groupEq }),
          };
        }
        return {};
      });

      const { getActiveServiceKeysForUser } = await import(
        "@/lib/services/user-entitlements"
      );

      const keys = await getActiveServiceKeysForUser("user-1");

      expect(keys).toContain("core_v1");
      expect(keys).toContain("autonomous_annual");
      expect(keys).not.toContain("intelligence_annual");
    });

    it("includes tier inclusions for trial/beta groups", async () => {
      const subscriptionsData = [
        { service_key: "core_v1", status: "active" },
      ];
      const subEq = vi
        .fn()
        .mockResolvedValue({ data: subscriptionsData, error: null });
      const groupData = { subscription_group: "trial" };
      const groupEq = vi.fn().mockReturnValue({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: groupData, error: null }),
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === "user_subscriptions") {
          return {
            select: vi.fn().mockReturnValue({ eq: subEq }),
            upsert: vi.fn().mockResolvedValue({ error: null, data: null }),
          };
        }
        if (table === "user_group_assignments") {
          return {
            select: vi.fn().mockReturnValue({ eq: groupEq }),
          };
        }
        return {};
      });

      const { getActiveServiceKeysForUser } = await import(
        "@/lib/services/user-entitlements"
      );

      const keys = await getActiveServiceKeysForUser("user-1");

      expect(keys).toContain("core_v1");
      expect(keys).toContain("intelligence_annual");
      expect(keys).toContain("autonomous_annual");
    });
  });
});
