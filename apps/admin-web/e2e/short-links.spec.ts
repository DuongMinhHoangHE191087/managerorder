import { expect, test, type Page } from "@playwright/test";

const NOW = "2026-04-25T10:30:00.000Z";

const SHORT_LINKS = [
  {
    id: "00000000-0000-4000-8000-000000000091",
    account_id: "00000000-0000-4000-8000-000000000009",
    slug: "family-plan",
    target_url: "https://invite.duolingo.com/family-plan",
    title: "Duolingo Gia Đình HX136",
    max_clicks: 3,
    current_clicks: 0,
    expires_at: "2026-04-28T00:00:00.000Z",
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    order_id: "00000000-0000-4000-8000-00000000000a",
    customer_id: null,
    created_by: null,
    status: "active",
    require_token: true,
    access_token: "TOKEN123456",
    locked_ip: null,
    locked_ipv6: null,
    notify_clicks: true,
    sales_channel_id: "00000000-0000-4000-8000-00000000000b",
    delivery_mode: "landing_page",
    landing_template_key: "owner_intro",
    failure_template_key: "customer_offer_wall",
    seller_contact_url: "https://zalo.me/renewal-shop",
  },
  {
    id: "00000000-0000-4000-8000-000000000092",
    account_id: "00000000-0000-4000-8000-000000000009",
    slug: "canva-trial",
    target_url: "https://example.com/canva-trial",
    title: "Canva Trial",
    max_clicks: 5,
    current_clicks: 3,
    expires_at: "2026-04-20T00:00:00.000Z",
    created_at: "2026-04-18T08:00:00.000Z",
    updated_at: NOW,
    deleted_at: null,
    order_id: null,
    customer_id: null,
    created_by: null,
    status: "expired",
    require_token: false,
    access_token: null,
    locked_ip: "203.113.0.15",
    locked_ipv6: null,
    notify_clicks: false,
    sales_channel_id: null,
    delivery_mode: "direct_redirect",
    landing_template_key: null,
    failure_template_key: "seller_unlock_request",
    seller_contact_url: null,
  },
] as const;

async function mockShortLinkApis(page: Page) {
  await page.route("**/api/notifications/feed*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.route("**/api/settings/sales-channels", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "00000000-0000-4000-8000-00000000000b",
            name: "CTV Gia Hạn",
            code: "CTV-GIA-HAN",
            description: "Kênh bán chuyên xử lý nhắc gia hạn",
            defaultDeliveryMode: "landing_page",
            defaultLandingTemplateKey: "owner_intro",
            defaultFailureTemplateKey: "customer_offer_wall",
            sellerContactUrl: "https://zalo.me/renewal-shop",
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      }),
    });
  });

  await page.route("**/api/short-links*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: SHORT_LINKS }),
    });
  });
}

test.describe("Short links", () => {
  test.setTimeout(90_000);

  test("renders the list shell", async ({ page }) => {
    await mockShortLinkApis(page);
    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === "GET" && response.url().includes("/api/short-links")
    );

    await page.goto("/short-links", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await responsePromise;

    await expect(page.getByTestId("short-links-search")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("short-links-create-toggle")).toBeVisible();
    await expect(page.locator('[data-short-link-id="00000000-0000-4000-8000-000000000091"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-short-link-id="00000000-0000-4000-8000-000000000092"]')).toBeVisible({ timeout: 30_000 });
  });

  test("filters and searches links", async ({ page }) => {
    await mockShortLinkApis(page);
    const responsePromise = page.waitForResponse((response) =>
      response.request().method() === "GET" && response.url().includes("/api/short-links")
    );

    await page.goto("/short-links", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await responsePromise;
    await expect(page.getByTestId("short-links-search")).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("short-links-filter-expired").click();
    await expect(page.locator('[data-short-link-id="00000000-0000-4000-8000-000000000092"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-short-link-id="00000000-0000-4000-8000-000000000091"]')).toHaveCount(0);

    await page.getByTestId("short-links-search").fill("gia dinh hx136");
    await expect(page.getByTestId("short-links-empty-state")).toBeVisible();

    await page.getByTestId("short-links-filter-all").click();
    await page.getByTestId("short-links-search").fill("");
    await expect(page.locator('[data-short-link-id="00000000-0000-4000-8000-000000000091"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-short-link-id="00000000-0000-4000-8000-000000000092"]')).toBeVisible({ timeout: 30_000 });
  });
});
