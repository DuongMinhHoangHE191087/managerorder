import type { Locator, Page } from "@playwright/test";

export class InventoryPage {
  readonly page: Page;
  readonly navInventory: Locator;
  readonly statsSection: Locator;
  readonly searchInput: Locator;
  readonly providerFilter: Locator;
  readonly statusFilter: Locator;
  readonly tableContainer: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;
  readonly accountCount: Locator;
  readonly sortEmail: Locator;
  readonly sortSlots: Locator;
  readonly sortExpiry: Locator;
  readonly sortStatus: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly paginationInfo: Locator;
  readonly selectAllCheckbox: Locator;
  readonly expiryWarnings: Locator;
  readonly fullSlotWarnings: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navInventory = page.getByRole("link", { name: /kho hàng|inventory/i }).first();
    this.statsSection = page.locator("[class*='stats'], [class*='dashboard']").first();
    this.searchInput = page.getByPlaceholder(/tìm kiếm|search/i).first();
    this.providerFilter = page.locator("select, [role='combobox']").first();
    this.statusFilter = page.locator("select, [role='combobox']").nth(1);
    this.tableContainer = page.locator("[data-testid='inventory-list-shell'], [data-testid='inventory-list']").first();
    this.tableRows = page.locator("[data-testid='inventory-row']");
    this.emptyState = page.locator("[data-testid='inventory-empty-state']").first();
    this.accountCount = page.locator("[data-testid='inventory-account-count']").first();
    this.sortEmail = page.locator("[data-testid='inventory-sort-email']").first();
    this.sortSlots = page.locator("[data-testid='inventory-sort-slots']").first();
    this.sortExpiry = page.locator("[data-testid='inventory-sort-expiry']").first();
    this.sortStatus = page.locator("[data-testid='inventory-sort-status']").first();
    this.paginationPrev = page.locator("[data-testid='inventory-prev-page']").first();
    this.paginationNext = page.locator("[data-testid='inventory-next-page']").first();
    this.paginationInfo = page.locator("[data-testid='inventory-pagination-info']").first();
    this.selectAllCheckbox = page.locator("[data-testid='inventory-select-all']").first();
    this.expiryWarnings = page.locator("text=/Đã hết hạn|Còn \\d+ ngày|Het han|Con \\d+ ngay/i");
    this.fullSlotWarnings = page.getByText(/Đã đầy|Da day/i);
  }

  async goto() {
    await this.page.request.get("/api/auth/session/me", { timeout: 10_000 }).catch(() => null);
    await this.page.goto("/inventory", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await this.tableContainer.waitFor({ state: "visible", timeout: 30_000 });
    await this.page
      .waitForResponse((response) => response.url().includes("/api/source-accounts") && response.status() < 500, {
        timeout: 30_000,
      })
      .catch(() => null);
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(500);
  }

  async sortBy(column: "email" | "slots" | "expiry" | "status") {
    const headers: Record<string, Locator> = {
      email: this.sortEmail,
      slots: this.sortSlots,
      expiry: this.sortExpiry,
      status: this.sortStatus,
    };
    await headers[column].click();
    await this.page.waitForTimeout(200);
  }

  async getVisibleRowCount(): Promise<number> {
    return this.page.locator("[data-testid='inventory-row']:visible").count();
  }

  async getVisibleEmails(): Promise<string[]> {
    const emailNodes = this.page.locator("[data-testid='inventory-row']:visible [data-testid='inventory-row-email']");
    const count = await emailNodes.count();
    const emails: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await emailNodes.nth(i).textContent();
      if (text?.trim()) emails.push(text.trim());
    }
    return emails;
  }

  async nextPage() {
    await this.paginationNext.click();
    await this.page.waitForTimeout(300);
  }

  async prevPage() {
    await this.paginationPrev.click();
    await this.page.waitForTimeout(300);
  }

  async clickRow(email: string) {
    const row = this.page.locator(`[data-testid='inventory-row'][data-email="${email}"]`).first();
    const accountId = await row.getAttribute("data-account-id");
    await row.scrollIntoViewIfNeeded();
    await row.click({ position: { x: 80, y: 20 } });
    if (accountId) {
      await this.page
        .waitForURL(/\/inventory\/source-accounts\//, { timeout: 3_000 })
        .catch(async () => {
          await this.page.goto(`/inventory/source-accounts/${accountId}`, { waitUntil: "domcontentloaded" });
        });
    }
  }

  async rightClickRow(email: string) {
    await this.tableRows.filter({ hasText: email }).first().click({ button: "right" });
  }

  async toggleRowCheckbox(email: string) {
    await this.tableRows.filter({ hasText: email }).first().locator("[data-testid='inventory-row-checkbox']").click();
  }

  async selectAll() {
    await this.selectAllCheckbox.click();
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async getSlotPercentage(email: string): Promise<string> {
    const percentText = await this.tableRows.filter({ hasText: email }).first().locator("text=/%$/").textContent();
    return percentText?.trim() ?? "0%";
  }

  async getPaginationInfo(): Promise<string | null> {
    return this.paginationInfo.textContent();
  }

  async waitForTable() {
    await this.tableContainer.waitFor({ state: "visible", timeout: 30_000 });
    await this.page.locator("[data-testid='inventory-list-loading']").waitFor({ state: "detached", timeout: 30_000 }).catch(() => null);
    await this.page
      .locator("[data-testid='inventory-row']:visible, [data-testid='inventory-empty-state']")
      .first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => null);
  }

  async hasFullSlotWarning(): Promise<boolean> {
    return this.fullSlotWarnings.first().isVisible();
  }

  async hasExpiryWarnings(): Promise<boolean> {
    return this.expiryWarnings.first().isVisible();
  }
}
