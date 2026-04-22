/**
 * ============================================================
 * PAGE OBJECT MODEL — Inventory Page
 *
 * Encapsulates all UI interactions for the Inventory module.
 * Follows POM pattern for maintainability and reusability.
 * ============================================================
 */
import type { Page, Locator } from "@playwright/test";

export class InventoryPage {
  readonly page: Page;

  // ── Navigation ────────────────────────────────────────────
  readonly navInventory: Locator;

  // ── Stats Cards ───────────────────────────────────────────
  readonly statsSection: Locator;

  // ── Filters ───────────────────────────────────────────────
  readonly searchInput: Locator;
  readonly providerFilter: Locator;
  readonly statusFilter: Locator;

  // ── Table ─────────────────────────────────────────────────
  readonly tableContainer: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;
  readonly accountCount: Locator;

  // ── Sort Headers ──────────────────────────────────────────
  readonly sortEmail: Locator;
  readonly sortSlots: Locator;
  readonly sortExpiry: Locator;
  readonly sortStatus: Locator;

  // ── Pagination ────────────────────────────────────────────
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly paginationInfo: Locator;

  // ── Bulk Selection ────────────────────────────────────────
  readonly selectAllCheckbox: Locator;

  // ── Alerts / Warnings ─────────────────────────────────────
  readonly expiryWarnings: Locator;
  readonly fullSlotWarnings: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.navInventory = page.getByRole("link", { name: /kho hàng|inventory/i });

    // Stats section
    this.statsSection = page.locator("[class*='stats'], [class*='dashboard']").first();

    // Filters
    this.searchInput = page.getByPlaceholder(/tìm kiếm|search/i);
    this.providerFilter = page.locator("select, [role='combobox']").first();
    this.statusFilter = page.locator("select, [role='combobox']").nth(1);

    // Table
    this.tableContainer = page.locator("table").first();
    this.tableRows = page.locator("tbody tr");
    this.emptyState = page.getByText(/không có account nguồn nào/i);
    this.accountCount = page.getByText(/tài khoản$/);

    // Sort headers (using text matching from UI)
    this.sortEmail = page.locator("th").filter({ hasText: "Tài khoản" });
    this.sortSlots = page.locator("th").filter({ hasText: "Slot" });
    this.sortExpiry = page.locator("th").filter({ hasText: "Hết hạn" });
    this.sortStatus = page.locator("th").filter({ hasText: "Trạng thái" });

    // Pagination
    this.paginationPrev = page.getByRole("button", { name: /trước/i });
    this.paginationNext = page.getByRole("button", { name: /tiếp/i });
    this.paginationInfo = page.locator("text=/Hiển thị .*/");

    // Bulk selection
    this.selectAllCheckbox = page.locator("thead input[type='checkbox']");

    // Warnings
    this.expiryWarnings = page.locator("text=/Đã hết hạn|Còn \\d+ ngày/");
    this.fullSlotWarnings = page.getByText("Đã đầy");
  }

  // ── Actions ───────────────────────────────────────────────

  /** Navigate to inventory page */
  async goto() {
    await this.page.goto("/inventory");
    await this.page.waitForLoadState("networkidle");
  }

  /** Search/filter accounts by text */
  async search(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce
    await this.page.waitForTimeout(300);
  }

  /** Clear search field */
  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /** Sort by a column */
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

  /** Get number of visible table rows */
  async getVisibleRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  /** Get all email texts from visible rows */
  async getVisibleEmails(): Promise<string[]> {
    const rows = await this.tableRows.all();
    const emails: string[] = [];
    for (const row of rows) {
      const email = await row.locator("td:first-child span, td:nth-child(2) span").first().textContent();
      if (email) emails.push(email.trim());
    }
    return emails;
  }

  /** Navigate to next page */
  async nextPage() {
    await this.paginationNext.click();
    await this.page.waitForTimeout(300);
  }

  /** Navigate to previous page */
  async prevPage() {
    await this.paginationPrev.click();
    await this.page.waitForTimeout(300);
  }

  /** Click a specific row by account email */
  async clickRow(email: string) {
    const row = this.tableRows.filter({ hasText: email });
    await row.click();
    await this.page.waitForLoadState("networkidle");
  }

  /** Right-click a row for context menu */
  async rightClickRow(email: string) {
    const row = this.tableRows.filter({ hasText: email });
    await row.click({ button: "right" });
  }

  /** Select/deselect a row's checkbox */
  async toggleRowCheckbox(email: string) {
    const row = this.tableRows.filter({ hasText: email });
    const checkbox = row.locator("input[type='checkbox']");
    await checkbox.click();
  }

  /** Select all visible rows */
  async selectAll() {
    await this.selectAllCheckbox.click();
  }

  /** Check if empty state is visible */
  async isEmptyStateVisible(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  /** Get slot fill percentage from a row */
  async getSlotPercentage(email: string): Promise<string> {
    const row = this.tableRows.filter({ hasText: email });
    const percentText = await row.locator("text=/%$/").textContent();
    return percentText?.trim() ?? "0%";
  }

  /** Get pagination info text */
  async getPaginationInfo(): Promise<string | null> {
    return this.paginationInfo.textContent();
  }

  /** Wait for table to load */
  async waitForTable() {
    await this.tableContainer.waitFor({ state: "visible", timeout: 10_000 });
  }

  /** Check if "Đã đầy" warning is visible for any row */
  async hasFullSlotWarning(): Promise<boolean> {
    return this.fullSlotWarnings.first().isVisible();
  }

  /** Check for expiry warnings */
  async hasExpiryWarnings(): Promise<boolean> {
    return this.expiryWarnings.first().isVisible();
  }
}
