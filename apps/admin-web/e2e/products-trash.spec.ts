import { randomUUID } from "crypto";
import { expect, test, type APIResponse, type Page } from "@playwright/test";

async function readJson<T>(response: APIResponse, label: string): Promise<T> {
  const text = await response.text();
  expect(
    response.ok(),
    `${label} failed with ${response.status()}: ${text}`,
  ).toBeTruthy();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned non-JSON payload: ${text}`);
  }
}

async function postJson<T>(page: Page, path: string, data: unknown): Promise<T> {
  return readJson<T>(await page.request.post(path, { data }), `POST ${path}`);
}

async function bestEffortDelete(page: Page, id: string): Promise<void> {
  try {
    await page.request.delete(`/api/products/${id}`);
  } catch {
    // Best-effort cleanup only.
  }

  try {
    await page.request.post("/api/trash/purge", {
      data: { type: "products", ids: [id] },
    });
  } catch {
    // Best-effort cleanup only.
  }
}

async function mockShell(page: Page) {
  await page.route("**/api/notifications/feed*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
}

test.describe.serial("Products and trash flow", () => {
  test.setTimeout(180_000);

  test("delete product moves it to trash and trash detail can restore or purge", async ({ page }) => {
    await mockShell(page);

    const suffix = randomUUID().slice(0, 8);
    const productOneName = `Smoke Product A ${suffix}`;
    const productTwoName = `Smoke Product B ${suffix}`;

    const createdProductIds: string[] = [];

    try {
      const productOne = await postJson<{ data: { id: string } }>(page, "/api/products", {
        name: productOneName,
        mode: "key",
        buyPriceVnd: 100_000,
        sellPriceVnd: 200_000,
        durationType: "months",
        durationValue: 1,
        isActive: true,
      });
      const productTwo = await postJson<{ data: { id: string } }>(page, "/api/products", {
        name: productTwoName,
        mode: "slot",
        buyPriceVnd: 120_000,
        sellPriceVnd: 210_000,
        durationType: "months",
        durationValue: 3,
        isActive: true,
      });

      createdProductIds.push(productOne.data.id, productTwo.data.id);

      await page.goto("/products", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByTestId("products-search").fill(suffix);

      const productOneRow = page
        .locator(`[data-testid="product-row"][data-product-id="${productOne.data.id}"]`)
        .first();
      const productTwoRow = page
        .locator(`[data-testid="product-row"][data-product-id="${productTwo.data.id}"]`)
        .first();

      await expect(productOneRow).toBeVisible();
      await expect(productTwoRow).toBeVisible();

      await productTwoRow.locator('button[aria-label="Thao tác"]').click();
      const deleteAction = page.getByRole("button", { name: "Xóa sản phẩm" });
      await expect(deleteAction).toBeVisible();
      await deleteAction.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("button", { name: "Xóa vĩnh viễn" }).click();

      await expect(page.locator(`[data-testid="product-row"][data-product-id="${productTwo.data.id}"]`)).toHaveCount(0);
      await expect(page.locator(`[data-testid="product-row"][data-product-id="${productOne.data.id}"]`)).toBeVisible();

      await readJson<{ success: true }>(
        await page.request.delete(`/api/products/${productOne.data.id}`),
        `DELETE /api/products/${productOne.data.id}`,
      );

      await page.goto("/trash?type=products", { waitUntil: "domcontentloaded", timeout: 60_000 });
      const trashSearch = page.getByPlaceholder(/Tìm trong|Search|search/i).first();
      await trashSearch.fill(suffix);

      const trashRowOne = page.locator("tbody tr").filter({ hasText: productOneName });
      const trashRowTwo = page.locator("tbody tr").filter({ hasText: productTwoName });

      await expect(trashRowOne).toBeVisible();
      await expect(trashRowTwo).toBeVisible();

      const preview = page.getByTestId("trash-preview");

      await trashRowOne.click();
      await expect(preview).toHaveAttribute("data-focused-id", productOne.data.id);

      await trashRowTwo.click();
      await expect(preview).toHaveAttribute("data-focused-id", productTwo.data.id);

      await trashRowOne.dblclick();
      await expect(page).toHaveURL(new RegExp(`/products\\?view=${productOne.data.id}&trash=1`));
      await page.getByRole("button", { name: "Khôi phục" }).click();
      await expect(page).toHaveURL(/\/products$/);
      await page.waitForLoadState("networkidle");
      await page.getByTestId("products-search").fill(suffix);
      await expect(page.locator(`[data-testid="product-row"][data-product-id="${productOne.data.id}"]`)).toBeVisible({ timeout: 20_000 });

      await page.goto("/trash?type=products", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await trashSearch.fill(suffix);
      await trashRowTwo.dblclick();
      await expect(page).toHaveURL(new RegExp(`/products\\?view=${productTwo.data.id}&trash=1`));
      await page.getByRole("button", { name: "Xóa vĩnh viễn" }).click();
      await expect(page).toHaveURL(/\/trash\?type=products/);

      await page.goto("/trash?type=products", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await trashSearch.fill(suffix);
      await expect(page.locator("tbody tr").filter({ hasText: productTwoName })).toHaveCount(0);
    } finally {
      for (const id of createdProductIds) {
        await bestEffortDelete(page, id);
      }
    }
  });
});
