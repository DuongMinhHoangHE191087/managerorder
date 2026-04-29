import { test, expect } from "@playwright/test";
import { InventoryPage } from "./pages/inventory-page";

test.setTimeout(90_000);

test.describe("Inventory Page - Load & Display", () => {
  test("should load inventory page and show account list", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    await expect(inventory.tableContainer).toBeVisible();
    await expect(inventory.tableRows.first()).toBeVisible();
  });

  test("should show empty state when search has no matches", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.search("xyznonexistent12345");
    await expect(inventory.emptyState).toBeVisible();
  });

  test("should display account count in header", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    const countText = await inventory.accountCount.textContent();
    expect(countText).toMatch(/\d+.*(tài khoản|tai khoan)/i);
  });
});

test.describe("Inventory Page - Search & Filtering", () => {
  test("should filter accounts by search text", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    const initialCount = await inventory.getVisibleRowCount();
    const visibleEmails = await inventory.getVisibleEmails();
    expect(visibleEmails.length).toBeGreaterThan(0);
    await inventory.search(visibleEmails[0]);
    const filteredCount = await inventory.getVisibleRowCount();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("should clear search and restore full list", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    const initialCount = await inventory.getVisibleRowCount();
    await inventory.search("e2e-inventory");
    await inventory.clearSearch();
    await expect.poll(() => inventory.getVisibleRowCount()).toBe(initialCount);
  });
});

test.describe("Inventory Page - Column Sorting", () => {
  test("should sort by email ascending then descending", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    await inventory.sortBy("email");
    const ascEmails = await inventory.getVisibleEmails();
    await inventory.sortBy("email");
    const descEmails = await inventory.getVisibleEmails();
    expect(descEmails.length).toBeGreaterThan(0);
    expect(descEmails).not.toEqual(ascEmails);
    if (ascEmails.length > 1 && descEmails.length > 1) {
      expect(descEmails[0]).not.toBe(ascEmails[0]);
    }
  });

  test("should keep rows visible after sorting slot, expiry and status", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    for (const column of ["slots", "expiry", "status"] as const) {
      await inventory.sortBy(column);
      expect(await inventory.getVisibleRowCount()).toBeGreaterThan(0);
    }
  });
});

test.describe("Inventory Page - Pagination", () => {
  test("should show pagination info text", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    const info = await inventory.getPaginationInfo();
    expect(info).toMatch(/\d+.*\/.*\d+.*(tài khoản|tai khoan)/i);
  });

  test("should disable prev button on first page", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    await expect(inventory.paginationPrev).toBeDisabled();
  });
});

test.describe("Inventory Page - Alerts & Navigation", () => {
  test("should expose warning checks without crashing", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    expect(typeof await inventory.hasFullSlotWarning()).toBe("boolean");
    expect(typeof await inventory.hasExpiryWarnings()).toBe("boolean");
  });

  test("should navigate to account detail on row click", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();
    const firstRow = inventory.tableRows.first();
    const email = await firstRow.getAttribute("data-email");
    expect(email).toBeTruthy();
    await inventory.clickRow(email!);
    await expect(page).toHaveURL(/\/inventory\/source-accounts\//, { timeout: 20_000 });
  });
});
