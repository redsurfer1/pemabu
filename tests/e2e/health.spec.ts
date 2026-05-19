import { test, expect } from "@playwright/test";

test("homepage loads and shows the marketing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Pemabu|Portfolio/);
});

test("pricing page is accessible", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator("body")).not.toHaveText("not found");
});

test("login page redirects to auth", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/auth/);
});
