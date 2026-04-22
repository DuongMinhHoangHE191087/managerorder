/**
 * Page Object — Customers Page
 *
 * Encapsulates selectors and actions for the customers list page.
 */
import { type Page, type Locator } from "@playwright/test";

export class CustomersPage {
  readonly page: Page;
  readonly tableContainer: Locator;
  readonly searchInput: Locator;
  readonly addButton: Locator;
  readonly customerRows: Locator;
  readonly paginationNext: Locator;
  readonly paginationPrev: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tableContainer = page.locator("table, [role='table'], [data-testid='customer-table']");
    this.searchInput = page.locator(
      "input[placeholder*='Tìm'], input[placeholder*='tìm'], input[placeholder*='Search'], input[placeholder*='search']"
    );
    this.addButton = page.locator(
      "button:has-text('Thêm'), button:has-text('Tạo'), button:has-text('Add'), a:has-text('Thêm')"
    );
    this.customerRows = page.locator("tbody tr");
    this.paginationNext = page.locator(
      "button[aria-label='Next'], button:has-text('Sau'), button:has-text('Next'), [data-testid='pagination-next']"
    );
    this.paginationPrev = page.locator(
      "button[aria-label='Previous'], button:has-text('Trước'), button:has-text('Previous'), [data-testid='pagination-prev']"
    );
    this.emptyState = page.locator(
      "[data-testid='empty-state'], .empty-state, :text('Chưa có khách hàng')"
    );
  }

  async goto() {
    await this.page.goto("/customers");
    await this.page.waitForLoadState("networkidle");
  }

  async waitForTable() {
    await this.tableContainer.first().waitFor({ state: "visible", timeout: 15_000 });
  }

  async getVisibleRowCount(): Promise<number> {
    return this.customerRows.count();
  }

  async search(query: string) {
    await this.searchInput.first().fill(query);
    // Wait for debounced search
    await this.page.waitForTimeout(500);
    await this.page.waitForLoadState("networkidle");
  }

  async clickAddCustomer() {
    await this.addButton.first().click();
  }

  async clickCustomerRow(index: number) {
    await this.customerRows.nth(index).click();
  }

  async getCustomerNames(): Promise<string[]> {
    // Customer name is typically in the first meaningful column
    const nameElements = this.page.locator("tbody tr td:first-child, tbody tr td:nth-child(2)");
    const count = await nameElements.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await nameElements.nth(i).textContent();
      if (text?.trim()) names.push(text.trim());
    }
    return names;
  }
}
