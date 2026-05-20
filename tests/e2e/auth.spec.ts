/**
 * tests/e2e/auth.spec.ts
 *
 * Playwright E2E — authentication flow tests.
 *
 * These tests require only a running Next.js dev/preview server; they do NOT
 * need a real authenticated user session (they verify redirect + protection
 * behaviour for unauthenticated requests).
 *
 * Runs as part of `npx playwright test` against the server configured in
 * playwright.config.ts (defaults to http://localhost:3000).
 */

import { test, expect } from "@playwright/test";

// ── Unauthenticated redirect tests ────────────────────────────────────────────

test.describe("Unauthenticated access", () => {
  test("GET /dashboard redirects to the auth page", async ({ page }) => {
    await page.goto("/dashboard");
    // Middleware should redirect any unauthenticated workspace path to /auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test("GET /portfolio/engine redirects to the auth page", async ({ page }) => {
    await page.goto("/portfolio/engine");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("GET /marketplace redirects to the auth page", async ({ page }) => {
    await page.goto("/marketplace");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("GET /strategy-council redirects to the auth page", async ({ page }) => {
    await page.goto("/strategy-council");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("GET /tax redirects to the auth page", async ({ page }) => {
    await page.goto("/tax");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("GET /creator/dashboard redirects to the auth page", async ({ page }) => {
    await page.goto("/creator/dashboard");
    await expect(page).toHaveURL(/\/auth/);
  });
});

// ── API route protection tests (unauthenticated) ──────────────────────────────

test.describe("API routes — unauthenticated return 401", () => {
  test("GET /api/workbook/portfolios → 401", async ({ request }) => {
    const res = await request.get("/api/workbook/portfolios");
    expect(res.status()).toBe(401);

    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/unauthorized/i);
  });

  test("POST /api/workbook/portfolios → 401 (no auth cookie)", async ({ request }) => {
    const res = await request.post("/api/workbook/portfolios", {
      data: { name: "Test", currency: "USD" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/workbook/brief → 401", async ({ request }) => {
    const res = await request.post("/api/workbook/brief", {
      data: { portfolioId: "00000000-0000-0000-0000-000000000001" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/portfolio/refresh → 401 on arbitrary portfolioId", async ({ request }) => {
    const res = await request.post(
      "/api/portfolio/00000000-0000-0000-0000-000000000001/refresh",
    );
    expect(res.status()).toBe(401);
  });

  test("GET /api/tax/form-8949 → 401", async ({ request }) => {
    const res = await request.get("/api/tax/form-8949?year=2024");
    expect(res.status()).toBe(401);
  });

  test("GET /api/prices/current → 401", async ({ request }) => {
    const res = await request.get("/api/prices/current?tickers=AAPL");
    expect(res.status()).toBe(401);
  });
});

// ── Admin route protection tests (unauthenticated) ────────────────────────────

test.describe("Admin API routes — unauthenticated return 401", () => {
  const adminRoutes = [
    "/api/admin/users",
    "/api/admin/portfolios",
    "/api/admin/subscriptions",
    "/api/admin/groups",
    "/api/admin/stats",
  ];

  for (const route of adminRoutes) {
    test(`GET ${route} → 401`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.status()).toBe(401);
    });
  }
});

// ── Public / marketing pages ───────────────────────────────────────────────────

test.describe("Public pages load without auth", () => {
  test("Homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Pemabu|Portfolio/i);
    // Must not redirect to /auth — it's a public page
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test("Pricing page is accessible", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("body")).not.toContainText("Not Found");
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test("Auth page renders a sign-in form", async ({ page }) => {
    await page.goto("/auth");
    // Expect either an email input or a sign-in heading
    const hasInput = await page.locator('input[type="email"]').count();
    const hasHeading = await page.locator("text=/sign in|log in|welcome/i").count();
    expect(hasInput + hasHeading).toBeGreaterThan(0);
  });
});

// ── Onboarding redirect gate ───────────────────────────────────────────────────

test.describe("Onboarding middleware gate", () => {
  test("/onboarding is accessible without hitting an auth redirect loop", async ({
    page,
  }) => {
    // Unauthenticated users hitting /onboarding should be redirected to /auth,
    // not loop between /onboarding and itself.
    await page.goto("/onboarding");
    const url = page.url();
    // Should be at /auth (auth guard fires first) or /onboarding itself
    // but never at an error page.
    expect(url).toMatch(/\/(auth|onboarding)/);
    await expect(page.locator("body")).not.toContainText("Application error");
  });
});
