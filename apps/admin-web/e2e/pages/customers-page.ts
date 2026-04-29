import { type Locator, type Page } from "@playwright/test";

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
    this.tableContainer = page.locator(
      "table, [role='table'], [data-testid='customer-table'], [data-testid='customer-list']"
    );
    this.searchInput = page.locator(
      "input[placeholder*='Tìm'], input[placeholder*='tìm'], input[placeholder*='Search'], input[placeholder*='search']"
    );
    this.addButton = page.locator(
      "button:has-text('Thêm'), button:has-text('Tạo'), button:has-text('Add'), a:has-text('Thêm')"
    );
    this.customerRows = page.locator("tbody tr, [data-testid='customer-row']");
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
    const responsePromise = this.page
      .waitForResponse(
        (response) => response.url().includes("/api/customers") && response.status() < 500,
        { timeout: 30_000 },
      )
      .catch(() => null);

    await this.page.goto("/customers", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await this.page.locator("[data-testid='customer-list']").first().waitFor({ state: "visible", timeout: 30_000 });
    await responsePromise;
  }

  async waitForTable() {
    await this.tableContainer.first().waitFor({ state: "visible", timeout: 30_000 });
    await this.page
      .locator("[data-testid='customer-row']:visible, text=/Chưa có khách hàng|Khong co khach hang/i")
      .first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => null);
  }

  async getVisibleRowCount(): Promise<number> {
    return this.page.locator("[data-testid='customer-row']:visible").count();
  }

  async search(query: string) {
    await this.searchInput.first().fill(query);
    await this.page.waitForTimeout(700);
  }

  async clickAddCustomer() {
    await this.addButton.first().click();
  }

  async clickCustomerRow(index: number) {
    await this.customerRows.nth(index).click();
  }

  async getCustomerNames(): Promise<string[]> {
    const nameElements = this.page.locator(
      "tbody tr td:first-child, tbody tr td:nth-child(2), [data-testid='customer-row'] h3"
    );
    const count = await nameElements.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await nameElements.nth(i).textContent();
      if (text?.trim()) names.push(text.trim());
    }
    return names;
  }
}
