import { expect, test } from "@playwright/test";

test.describe("Premium renewals", () => {
  test.setTimeout(90_000);

  test("shows renewal watchlist for expired and expiring nicks", async ({ page }) => {
    await page.route("**/api/premium/renewals?status=*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.route("**/api/premium/renewals/auto-run/history*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            items: [],
            meta: { count: 0, page: 1, limit: 5, totalPages: 1 },
            summary: { manualCount: 0, cronCount: 0, systemCount: 0, userCount: 0 },
          },
        }),
      });
    });

    await page.route("**/api/premium/renewals/watchlist*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            thresholdDays: 7,
            summary: { expiredCount: 1, expiringSoonCount: 1, totalActionable: 2 },
            expired: [
              {
                subscriptionId: "00000000-0000-4000-8000-0000000000a1",
                customerId: "00000000-0000-4000-8000-000000000005",
                customerName: "Khách A",
                serviceName: "Netflix Premium",
                nick: "nick.a",
                accountEmail: "account-a@example.test",
                expiryDate: "2026-04-20",
                expiryDateLabel: "20/04/2026",
                daysUntilExpiry: -4,
                urgency: "expired",
                contactChannel: "Zalo",
                contactValue: "khach-a-zalo",
                notificationMessage: "Mock message expired",
              },
            ],
            expiringSoon: [
              {
                subscriptionId: "00000000-0000-4000-8000-0000000000a2",
                customerId: "00000000-0000-4000-8000-000000000006",
                customerName: "Khách B",
                serviceName: "Canva Pro",
                nick: "nick.b",
                accountEmail: "account-b@example.test",
                expiryDate: "2026-04-27",
                expiryDateLabel: "27/04/2026",
                daysUntilExpiry: 3,
                urgency: "expiring",
                contactChannel: "Email",
                contactValue: "khach-b@example.test",
                notificationMessage: "Mock message expiring",
              },
            ],
          },
        }),
      });
    });

    const watchlistResponsePromise = page.waitForResponse((response) =>
      response.request().method() === "GET" && response.url().includes("/api/premium/renewals/watchlist")
    );

    await page.goto("/premium/renewals", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await watchlistResponsePromise;

    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("body")).toContainText("Auto-Renewal Engine");
    await expect(page.locator("body")).toContainText("Audit trail");
    await page.waitForFunction(
      () => document.body.innerText.includes("nick.a") && document.body.innerText.includes("nick.b"),
      null,
      { timeout: 30_000 }
    );
  });
});
