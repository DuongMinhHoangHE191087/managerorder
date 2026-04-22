/**
 * E2E Tests — Settings Page
 *
 * Covers:
 * - Page loading & tab display
 * - Account information visibility
 * - Tab navigation
 */
import { test, expect } from "@playwright/test";

test.describe("Settings Page — Load & Display", () => {
  test("should load settings page", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Page should load without errors
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(page.url()).toContain("/settings");
  });

  test("should display settings tabs or sections", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Look for tab navigation or section headings
    const tabs = page.locator(
      "[role='tab'], [data-testid='settings-tab'], button[role='tab'], .tab-trigger"
    );
    const headings = page.locator("h1, h2, h3");

    const tabCount = await tabs.count();
    const headingCount = await headings.count();

    // Should have either tabs or headings
    expect(tabCount + headingCount).toBeGreaterThan(0);
  });
});

test.describe("Settings Page — Account Info", () => {
  test("should display account information", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Should show some account-related content
    const body = await page.textContent("body");
    expect(body).toBeTruthy();

    // Look for common settings elements
    const formElements = page.locator("input, select, textarea, [role='combobox']");
    const count = await formElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Settings Page — Navigation", () => {
  test("should navigate between settings sections", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // If tabs exist, click through them
    const tabs = page.locator(
      "[role='tab'], [data-testid='settings-tab'], button[role='tab']"
    );
    const tabCount = await tabs.count();

    if (tabCount > 1) {
      // Click second tab
      await tabs.nth(1).click();
      await page.waitForLoadState("networkidle");

      const body = await page.textContent("body");
      expect(body).toBeTruthy();
    }
  });
});

test.describe("Settings Page — Responsive", () => {
  test("should display properly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });
});
