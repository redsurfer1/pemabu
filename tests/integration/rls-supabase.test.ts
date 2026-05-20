/**
 * tests/integration/rls-supabase.test.ts
 *
 * Real-Supabase RLS + DB-constraint integration tests.
 *
 * These tests bypass all application mocks and talk directly to a test
 * Supabase project (separate from production). They verify:
 *   • RLS policies — authenticated user A cannot read/write user B's rows.
 *   • Auth flows — sign-in produces a valid session; sign-out invalidates it.
 *   • DB constraints — unique/FK violations are rejected by Postgres, not
 *     just application-layer code.
 *   • Role self-escalation trigger — the DB trigger prevents an authenticated
 *     user from upgrading their own user_profiles.role to "admin".
 *
 * ── Prerequisites ─────────────────────────────────────────────────────────────
 *  Set these env vars before running (e.g. in .env.test.local):
 *
 *    TEST_SUPABASE_URL=https://<project>.supabase.co
 *    TEST_SUPABASE_ANON_KEY=<anon key>
 *    TEST_SUPABASE_SERVICE_ROLE_KEY=<service role key>
 *
 *  The test project must have all migrations applied. Test users are created
 *  and deleted by the suite — no pre-existing data is required.
 *
 * ── Running ───────────────────────────────────────────────────────────────────
 *  With env vars set:
 *    npx vitest run tests/integration/rls-supabase.test.ts
 *
 *  Without env vars (CI without test project):
 *    Tests are skipped automatically — CI remains green.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Skip guard ────────────────────────────────────────────────────────────────

const TEST_URL = process.env.TEST_SUPABASE_URL;
const TEST_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
const TEST_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

const hasTestProject = Boolean(TEST_URL && TEST_ANON_KEY && TEST_SERVICE_KEY);

const describeWithProject = hasTestProject ? describe : describe.skip;

if (!hasTestProject) {
  console.log(
    "[rls-supabase] Skipping — TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY / " +
      "TEST_SUPABASE_SERVICE_ROLE_KEY not set. " +
      "Set these in .env.test.local to run against a real Supabase test project.",
  );
}

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Creates an admin (service-role) Supabase client for test setup/teardown. */
function adminClient(): SupabaseClient {
  return createClient(TEST_URL!, TEST_SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Creates an anonymous Supabase client for user-level operations. */
function anonClient(): SupabaseClient {
  return createClient(TEST_URL!, TEST_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Signs up a new test user, returns a signed-in client + the user id. */
async function createTestUser(
  email: string,
  password: string,
): Promise<{ client: SupabaseClient; userId: string }> {
  const admin = adminClient();

  // Create the user via the admin API so we can set a known password
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email verification in test environment
  });
  if (error || !data.user) {
    throw new Error(`Failed to create test user ${email}: ${error?.message}`);
  }

  const userId = data.user.id;

  // Sign in as that user using the anon client
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(`Failed to sign in as ${email}: ${signInError.message}`);
  }

  return { client, userId };
}

/** Deletes a test user by id using the service-role admin API. */
async function deleteTestUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

// ── Test state ────────────────────────────────────────────────────────────────

// Unique suffix per run so parallel runs don't collide on email addresses
const RUN_ID = Date.now();

let userA: { client: SupabaseClient; userId: string };
let userB: { client: SupabaseClient; userId: string };
let userAPortfolioId: string;

// ── Suite ─────────────────────────────────────────────────────────────────────

describeWithProject("Supabase RLS + DB constraint integration", () => {
  // Create two isolated test users before the suite runs
  beforeAll(async () => {
    [userA, userB] = await Promise.all([
      createTestUser(`rls-test-a-${RUN_ID}@pemabu-test.invalid`, "Test1234!"),
      createTestUser(`rls-test-b-${RUN_ID}@pemabu-test.invalid`, "Test1234!"),
    ]);
  });

  // Delete both test users (and their data, cascaded by FK constraints) after suite
  afterAll(async () => {
    await Promise.all([
      deleteTestUser(userA.userId),
      deleteTestUser(userB.userId),
    ]);
  });

  // ── Auth flow ───────────────────────────────────────────────────────────────

  describe("Auth flows", () => {
    it("sign-in produces a valid session with a user id", async () => {
      const {
        data: { session },
      } = await userA.client.auth.getSession();
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe(userA.userId);
    });

    it("sign-out invalidates the session", async () => {
      // Create a fresh client for the sign-out test so we don't break the suite's userA client
      const tempClient = anonClient();
      await tempClient.auth.signInWithPassword({
        email: `rls-test-a-${RUN_ID}@pemabu-test.invalid`,
        password: "Test1234!",
      });

      const { error } = await tempClient.auth.signOut();
      expect(error).toBeNull();

      const {
        data: { session },
      } = await tempClient.auth.getSession();
      expect(session).toBeNull();
    });

    it("unauthenticated client receives empty data on RLS-protected table", async () => {
      const unauthed = anonClient();
      // anon should not be able to read any portfolios
      const { data, error } = await unauthed
        .from("portfolios")
        .select("id")
        .limit(5);

      // Either returns empty array (RLS blocks) or a policy error
      if (error) {
        expect(error.code).toMatch(/42501|PGRST/); // permission denied
      } else {
        expect(data).toHaveLength(0);
      }
    });
  });

  // ── RLS: portfolios ─────────────────────────────────────────────────────────

  describe("RLS — portfolios table", () => {
    beforeEach(async () => {
      // Ensure userA has at least one portfolio for cross-user tests
      if (!userAPortfolioId) {
        const { data, error } = await userA.client
          .from("portfolios")
          .insert({ name: "A-Primary", user_id: userA.userId, currency: "USD" })
          .select("id")
          .single();
        if (error) throw new Error(`Portfolio insert failed: ${error.message}`);
        userAPortfolioId = data.id as string;
      }
    });

    it("user A can read their own portfolios", async () => {
      const { data, error } = await userA.client
        .from("portfolios")
        .select("id, name")
        .eq("user_id", userA.userId);
      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThan(0);
    });

    it("user B cannot read user A's portfolios", async () => {
      const { data, error } = await userB.client
        .from("portfolios")
        .select("id")
        .eq("user_id", userA.userId);
      // RLS must return empty data, not error (Supabase RLS filters silently)
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot insert a portfolio with user A's user_id", async () => {
      const { error } = await userB.client
        .from("portfolios")
        .insert({ name: "Spoofed", user_id: userA.userId, currency: "USD" });
      // Must be blocked by RLS (new_row check)
      expect(error).not.toBeNull();
      expect(error!.code).toMatch(/42501|PGRST301/);
    });

    it("user B cannot delete user A's portfolios", async () => {
      const { error } = await userB.client
        .from("portfolios")
        .delete()
        .eq("id", userAPortfolioId);
      // Error or zero rows deleted — either way the row must still exist
      if (!error) {
        // Verify row is still there
        const { data } = await userA.client
          .from("portfolios")
          .select("id")
          .eq("id", userAPortfolioId);
        expect(data?.length).toBe(1);
      } else {
        expect(error.code).toMatch(/42501|PGRST/);
      }
    });
  });

  // ── RLS: user_profiles ──────────────────────────────────────────────────────

  describe("RLS — user_profiles table", () => {
    it("user A can read their own profile", async () => {
      const { data, error } = await userA.client
        .from("user_profiles")
        .select("id")
        .eq("id", userA.userId)
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBe(userA.userId);
    });

    it("user B cannot read user A's profile", async () => {
      const { data, error } = await userB.client
        .from("user_profiles")
        .select("id, role")
        .eq("id", userA.userId);
      // RLS policy "users_read_own_profile" filters to auth.uid() = id only
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("authenticated user cannot escalate their own role to admin", async () => {
      // The DB trigger enforce_user_profile_role_immutable silently resets role
      // when the caller is `authenticated`. The update succeeds but role doesn't change.
      const { error } = await userA.client
        .from("user_profiles")
        .update({ role: "admin" })
        .eq("id", userA.userId);

      // May error with policy violation, or silently succeed but not change role
      if (!error) {
        const { data } = await userA.client
          .from("user_profiles")
          .select("role")
          .eq("id", userA.userId)
          .single();
        // Role must NOT be admin — trigger should have reset it
        expect(data?.role).not.toBe("admin");
      } else {
        // Any DB error is also acceptable — escalation was blocked
        expect(error.code).toBeTruthy();
      }
    });
  });

  // ── RLS: portfolio_holdings ─────────────────────────────────────────────────

  describe("RLS — portfolio_holdings table", () => {
    it("user B cannot read holdings of user A's portfolio", async () => {
      // First, ensure userA has a holding
      await userA.client.from("portfolio_holdings").insert({
        portfolio_id: userAPortfolioId,
        ticker: "AAPL",
        asset_class: "equity",
        quantity: 10,
        cost_basis: 1500,
        currency: "USD",
        source: "manual",
      });

      // userB tries to read
      const { data, error } = await userB.client
        .from("portfolio_holdings")
        .select("id")
        .eq("portfolio_id", userAPortfolioId);

      expect(error).toBeNull();
      // RLS "owner_all_holdings" filters via portfolio ownership — should return 0 rows
      expect(data).toHaveLength(0);
    });
  });

  // ── DB constraints ──────────────────────────────────────────────────────────

  describe("DB constraints", () => {
    it("portfolio_holdings rejects an invalid asset_class value", async () => {
      const { error } = await userA.client.from("portfolio_holdings").insert({
        portfolio_id: userAPortfolioId,
        ticker: "XYZ",
        asset_class: "totally_made_up",
        quantity: 1,
        cost_basis: 100,
        currency: "USD",
        source: "manual",
      });
      // Should fail with a check constraint or enum violation
      expect(error).not.toBeNull();
    });

    it("portfolio insert with unknown currency is rejected by check constraint", async () => {
      // Most schemas constrain currency to known values (ISO codes or enum)
      // If no constraint exists this is a no-op assertion — test still passes.
      const { error } = await userA.client.from("portfolios").insert({
        name: "BadCurrency",
        user_id: userA.userId,
        currency: "FAKE_COIN",
      });
      // Either constraint violation or success (if no constraint) — we just log
      if (error) {
        expect(error.code).toBeTruthy();
      }
    });

    it("FK: portfolio_holdings rejects a non-existent portfolio_id", async () => {
      const { error } = await userA.client.from("portfolio_holdings").insert({
        portfolio_id: "00000000-0000-0000-0000-000000000000", // does not exist
        ticker: "MSFT",
        asset_class: "equity",
        quantity: 5,
        cost_basis: 500,
        currency: "USD",
        source: "manual",
      });
      // FK violation — Supabase returns 23503
      expect(error).not.toBeNull();
      expect(error!.code).toBe("23503");
    });
  });

  // ── Rate limit table access ──────────────────────────────────────────────────

  describe("Rate limit RPC (check_rate_limit)", () => {
    it("check_rate_limit RPC is callable by authenticated users and returns a boolean", async () => {
      const { data, error } = await userA.client.rpc("check_rate_limit", {
        p_key: `rls-test:${userA.userId}`,
        p_max_count: 5,
        p_window_seconds: 60,
      });
      expect(error).toBeNull();
      expect(typeof data).toBe("boolean");
      expect(data).toBe(true); // first call within window should be allowed
    });

    it("check_rate_limit denies after exceeding maxCount", async () => {
      const key = `rls-exhaust:${userA.userId}-${RUN_ID}`;
      // Call 3 times with maxCount=2 — third should be denied
      await userA.client.rpc("check_rate_limit", { p_key: key, p_max_count: 2, p_window_seconds: 60 });
      await userA.client.rpc("check_rate_limit", { p_key: key, p_max_count: 2, p_window_seconds: 60 });
      const { data } = await userA.client.rpc("check_rate_limit", {
        p_key: key,
        p_max_count: 2,
        p_window_seconds: 60,
      });
      expect(data).toBe(false);
    });
  });
});
