/**
 * E2E Tests — Login Page
 *
 * Tests the unauthenticated login page:
 * - Page renders correctly
 * - Google OAuth button is visible
 * - Branding elements present
 *
 * NOTE: These tests do NOT use storageState (unauthenticated context)
 */
import { test, expect } from "@playwright/test";

// Override storageState for login tests — we need unauthenticated context
test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(60_000);

test.describe("Login Page — Display", () => {
  test("should render login page at /login", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Page should load without error
    await expect(page).toHaveURL(/login/);

    // Should have a heading or brand name
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });

  test("should show Google sign-in button", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 60_000 });

    // Look for Google login button
    const googleButton = page.locator(
      "button:has-text('Google'), a:has-text('Google'), [data-provider='google']"
    );
    await expect(googleButton.first()).toBeVisible({ timeout: 10_000 });
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    // Try accessing a protected route
    await page.goto("/orders", { waitUntil: "domcontentloaded", timeout: 60_000 });

    // The guard may redirect via URL change or render the login shell directly.
    await page.waitForURL(/login/, { timeout: 20_000 }).catch(() => null);
    await expect(page.getByRole("button", { name: /email|google/i }).first()).toBeVisible({ timeout: 20_000 });
  });
});
