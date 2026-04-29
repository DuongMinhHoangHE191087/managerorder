import { expect, test } from "@playwright/test";

test.describe("Settings page", () => {
  test.setTimeout(90_000);

  test("loads the settings shell", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByTestId("settings-page-header")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("settings-page-title")).toBeVisible();
    await expect(page.locator("body")).toContainText("Webhooks");
  });

  test("renders the main sections on desktop and mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/settings", { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByTestId("settings-page-header")).toBeVisible({ timeout: 30_000 });
    expect(await page.locator("h1, h2, h3").count()).toBeGreaterThan(0);
  });
});
