import { expect, test, type Page } from "@playwright/test";

const NOW = "2026-04-25T10:30:00.000Z";

async function mockShell(page: Page) {
  await page.route("**/api/notifications/feed*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
}

test.describe("Filtering smoke", () => {
  test.setTimeout(90_000);

  test("providers page supports accent-insensitive search and tier filtering", async ({ page }) => {
    await mockShell(page);
    await page.route("**/api/providers", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "00000000-0000-4000-8000-0000000000b1",
              name: "Nguyễn Đạt Media",
              tier: "vip",
              reliabilityScore: 91,
              notes: null,
              totalDebtVnd: 0,
              totalSpendVnd: 2500000,
              contacts: [
                { id: "00000000-0000-4000-8000-000000000001", type: "phone", value: "0394497949", label: "Zalo", isPrimary: true },
              ],
              createdAt: NOW,
              updatedAt: NOW,
            },
            {
              id: "00000000-0000-4000-8000-0000000000b2",
              name: "Cloud Supplier",
              tier: "regular",
              reliabilityScore: 72,
              notes: null,
              totalDebtVnd: 0,
              totalSpendVnd: 1500000,
              contacts: [
                { id: "00000000-0000-4000-8000-000000000002", type: "email", value: "ops@cloud.example", label: "Mail", isPrimary: true },
              ],
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
        }),
      });
    });

    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === "GET" && response.url().includes("/api/providers")
    );

    await page.goto("/providers", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await responsePromise;

    await expect(page.getByTestId("provider-row")).toHaveCount(2);
    await page.getByTestId("providers-search").fill("nguyen dat");
    await expect(page.getByTestId("provider-row")).toHaveCount(1);
    await expect(page.getByTestId("provider-row").first()).toContainText("Media");

    await page.getByTestId("providers-tier-filter").selectOption("vip");
    await expect(page.getByTestId("provider-row")).toHaveCount(1);
  });

  test("products page supports accent-insensitive multi-term search", async ({ page }) => {
    await mockShell(page);
    await page.route("**/api/products", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "00000000-0000-4000-8000-0000000000c1",
              name: "Gói Gia Hạn 30 Ngày",
              mode: "slot",
              durationValue: 30,
              durationType: "days",
              buyPriceVnd: 120000,
              sellPriceVnd: 180000,
              isActive: true,
              description: null,
              createdAt: NOW,
              updatedAt: NOW,
            },
            {
              id: "00000000-0000-4000-8000-0000000000c2",
              name: "Key Canva Pro",
              mode: "key",
              durationValue: 12,
              durationType: "months",
              buyPriceVnd: 250000,
              sellPriceVnd: 320000,
              isActive: true,
              description: null,
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
        }),
      });
    });

    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === "GET" && response.url().includes("/api/products")
    );

    await page.goto("/products", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await responsePromise;

    await expect(page.getByTestId("product-row")).toHaveCount(2);
    await page.getByTestId("products-search").fill("gia han 30 ngay");
    await expect(page.getByTestId("product-row")).toHaveCount(1);

    await page.getByTestId("products-mode-filter").selectOption("slot");
    await expect(page.getByTestId("product-row")).toHaveCount(1);

    await page.getByTestId("products-mode-filter").selectOption("key");
    await expect(page.getByTestId("product-row")).toHaveCount(0);
  });
});
