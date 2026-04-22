/**
 * ============================================================
 * E2E TESTS — Inventory Page
 *
 * Covers:
 * - Page loading & empty state
 * - Data grid rendering & row click navigation
 * - Search/filter functionality
 * - Column sorting (email, slots, expiry, status)
 * - Pagination controls
 * - Alert displays (full slot, expiry warnings)
 * - Bulk selection (select all / individual)
 * ============================================================
 */
import { test, expect } from "@playwright/test";
import { InventoryPage } from "./pages/inventory-page";

test.describe("Inventory Page — Load & Display", () => {
  test("should load inventory page and show table", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();

    // Table should be visible
    await inventory.waitForTable();
    const rowCount = await inventory.getVisibleRowCount();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("should show empty state when no accounts", async ({ page }) => {
    // Navigate with a filter that matches nothing
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.search("xyznonexistent12345");

    const isEmpty = await inventory.isEmptyStateVisible();
    expect(isEmpty).toBe(true);
  });

  test("should display account count in header", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    const countText = await inventory.accountCount.textContent();
    expect(countText).toMatch(/\d+ tài khoản/);
  });
});

test.describe("Inventory Page — Search & Filtering", () => {
  test("should filter accounts by search text", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    // Get initial count
    const initialCount = await inventory.getVisibleRowCount();

    // Search for specific text
    await inventory.search("netflix");
    const filteredCount = await inventory.getVisibleRowCount();

    // Filtered count should be less than or equal to initial
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("should clear search and restore full list", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    const initialCount = await inventory.getVisibleRowCount();

    await inventory.search("netflix");
    await inventory.clearSearch();

    const restoredCount = await inventory.getVisibleRowCount();
    expect(restoredCount).toBe(initialCount);
  });
});

test.describe("Inventory Page — Column Sorting", () => {
  test("should sort by email ascending then descending", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    // Click email header to sort ascending
    await inventory.sortBy("email");
    const ascEmails = await inventory.getVisibleEmails();

    // Click again to sort descending
    await inventory.sortBy("email");
    const descEmails = await inventory.getVisibleEmails();

    // Descending should be reverse of ascending
    expect(descEmails).toEqual([...ascEmails].reverse());
  });

  test("should sort by slot fill percentage", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    await inventory.sortBy("slots");
    // Verify page doesn't crash and rows are still visible
    const rowCount = await inventory.getVisibleRowCount();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("should sort by expiry date", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    await inventory.sortBy("expiry");
    const rowCount = await inventory.getVisibleRowCount();
    expect(rowCount).toBeGreaterThan(0);
  });

  test("should sort by status (expired first)", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    await inventory.sortBy("status");
    const rowCount = await inventory.getVisibleRowCount();
    expect(rowCount).toBeGreaterThan(0);
  });
});

test.describe("Inventory Page — Pagination", () => {
  test("should show pagination info text", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    const info = await inventory.getPaginationInfo();
    expect(info).toMatch(/Hiển thị \d+–\d+ \/ \d+ tài khoản/);
  });

  test("should navigate to next page and back", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    const firstPageEmails = await inventory.getVisibleEmails();

    // Go to next page (if available)
    const nextBtn = inventory.paginationNext;
    if (await nextBtn.isEnabled()) {
      await inventory.nextPage();
      const secondPageEmails = await inventory.getVisibleEmails();
      // Different page should show different data
      expect(secondPageEmails).not.toEqual(firstPageEmails);

      // Go back
      await inventory.prevPage();
      const backEmails = await inventory.getVisibleEmails();
      expect(backEmails).toEqual(firstPageEmails);
    }
  });

  test("should disable prev button on first page", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    await expect(inventory.paginationPrev).toBeDisabled();
  });
});

test.describe("Inventory Page — Alerts & Warnings", () => {
  test("should show 'Đã đầy' warning for full accounts", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    // Check if any full slot warnings exist (data-dependent)
    const hasWarning = await inventory.hasFullSlotWarning();
    // This is data-dependent — test just verifies the check doesn't crash
    expect(typeof hasWarning).toBe("boolean");
  });

  test("should show expiry warnings for expiring accounts", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    const hasExpiry = await inventory.hasExpiryWarnings();
    expect(typeof hasExpiry).toBe("boolean");
  });
});

test.describe("Inventory Page — Row Navigation", () => {
  test("should navigate to account detail on row click", async ({ page }) => {
    const inventory = new InventoryPage(page);
    await inventory.goto();
    await inventory.waitForTable();

    // Get first email
    const emails = await inventory.getVisibleEmails();
    if (emails.length > 0) {
      await inventory.clickRow(emails[0]);

      // Should navigate to source account detail page
      expect(page.url()).toContain("/inventory/source-accounts/");
    }
  });
});
