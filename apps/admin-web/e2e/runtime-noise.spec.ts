import { expect, test, type Page } from "@playwright/test";
import { CustomersPage } from "./pages/customers-page";

async function mockShell(page: Page) {
  await page.route("**/api/notifications/feed*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
}

function trackConsoleNoise(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  return errors;
}

test.describe.serial("Runtime noise", () => {
  test.setTimeout(120_000);

  test("bot status unavailable is handled without console errors", async ({ page }) => {
    await mockShell(page);
    await page.route("**/api/settings/bot/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      });
    });

    const consoleErrors = trackConsoleNoise(page);

    await page.goto("/settings/bot", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByText(/bot chưa sẵn sàng|không có quyền/i).first()).toBeVisible();
    await page.waitForTimeout(1_500);

    expect(consoleErrors.some((text) => /401|Unauthorized|WebSocket|socket\.js/i.test(text))).toBe(false);
  });

  test("customers page does not open realtime websocket connections in development", async ({ page }) => {
    await mockShell(page);

    const consoleErrors = trackConsoleNoise(page);
    const customers = new CustomersPage(page);

    await customers.goto();
    await customers.waitForTable();
    await page.waitForTimeout(1_500);

    expect(consoleErrors.some((text) => /WebSocket connection|socket\.js|realtime|401 \(Unauthorized\)/i.test(text))).toBe(false);
  });
});
