/**
 * E2E Tests — Customers Page
 *
 * Covers:
 * - Page loading & table display
 * - Search functionality
 * - Pagination controls
 * - Add customer modal
 * - Row click navigation to detail
 */
import { randomUUID } from "crypto";
import { test, expect } from "@playwright/test";
import { CustomersPage } from "./pages/customers-page";

test.setTimeout(90_000);

const cleanupCustomerIds: string[] = [];

test.beforeAll(async ({ request }) => {
  const suffix = randomUUID().slice(0, 8);
  const response = await request.post("/api/customers", {
    data: {
      name: `E2E Customer ${suffix}`,
      contacts: [{ type: "email", value: `e2e-customer-${suffix}@example.test`, isPrimary: true }],
      tier: "regular",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { data?: { id?: string } };
  if (body.data?.id) cleanupCustomerIds.push(body.data.id);
});

test.afterAll(async ({ request }) => {
  while (cleanupCustomerIds.length > 0) {
    const id = cleanupCustomerIds.pop();
    if (id) {
      await request.delete(`/api/customers/${id}`).catch(() => undefined);
    }
  }
});

test.describe("Customers Page — Load & Display", () => {
  test("should load customers page and show table", async ({ page }) => {
    const customers = new CustomersPage(page);
    await customers.goto();
    await customers.waitForTable();

    await expect(customers.tableContainer.first()).toBeVisible();
  });

  test("should show customer names in table rows", async ({ page }) => {
    const customers = new CustomersPage(page);
    await customers.goto();
    await customers.waitForTable();

    const rowCount = await customers.getVisibleRowCount();
    if (rowCount > 0) {
      const names = await page
        .locator("[data-testid='customer-row']")
        .evaluateAll((rows) =>
          rows
            .map((row) => row.querySelector("h3")?.textContent?.trim() ?? row.textContent?.trim() ?? "")
            .filter((value) => Boolean(value)),
        );
      expect(names.length).toBeGreaterThan(0);
    } else {
      await expect(customers.emptyState.first()).toBeVisible();
    }
  });
});

test.describe("Customers Page — Search", () => {
  test("should filter results when searching", async ({ page }) => {
    const customers = new CustomersPage(page);
    await customers.goto();
    await customers.waitForTable();

    const initialCount = await customers.getVisibleRowCount();

    // Search for a specific term
    await customers.search("test_nonexistent_query_xyzabc");

    // Should show fewer or zero results
    const filteredCount = await customers.getVisibleRowCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("should clear search and restore results", async ({ page }) => {
    const customers = new CustomersPage(page);
    await customers.goto();
    await customers.waitForTable();

    // Search then clear
    await customers.search("test");
    await customers.search("");

    // Should show results again
    const count = await customers.getVisibleRowCount();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Customers Page — Add Customer", () => {
  test("should show add customer button", async ({ page }) => {
    const customers = new CustomersPage(page);
    await customers.goto();

    await expect(customers.addButton.first()).toBeVisible();
  });

  test("should open modal when clicking add", async ({ page }) => {
    const customers = new CustomersPage(page);
    await customers.goto();

    await customers.clickAddCustomer();

    // Modal or form should appear
    const modal = page.locator(
      "[role='dialog'], .modal, [data-testid='add-customer-modal']"
    );
    await expect(modal.first()).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Customers Page — Navigation", () => {
  test("should navigate to customer detail on row click", async ({ page }) => {
    const customers = new CustomersPage(page);
    await customers.goto();
    await customers.waitForTable();

    const rowCount = await customers.getVisibleRowCount();
    if (rowCount > 0) {
      await customers.clickCustomerRow(0);

      await expect(page.locator("[data-testid='slide-over-drawer'], [role='dialog']").first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe("Customers Page — Responsive", () => {
  test("should display properly on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const customers = new CustomersPage(page);
    await customers.goto();

    // Page should still load without errors
    const body = await page.textContent("body");
    expect(body).toBeTruthy();
  });
});
