/**
 * ============================================================
 * PAGE OBJECT MODEL — Order Checkout Page
 *
 * Encapsulates all UI interactions for the Order/Checkout module.
 * Follows POM pattern consistent with existing InventoryPage.
 *
 * Supports both the customer-facing checkout flow and the
 * admin-side order management interface.
 * ============================================================
 */
import type { Page, Locator } from "@playwright/test";

export class OrderCheckoutPage {
  readonly page: Page;

  // ── Navigation ────────────────────────────────────────────
  readonly navOrders: Locator;

  // ── Stats / Summary ───────────────────────────────────────
  readonly statsSection: Locator;
  readonly totalOrders: Locator;

  // ── Filters ───────────────────────────────────────────────
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly dateRangeFilter: Locator;

  // ── Order Table ───────────────────────────────────────────
  readonly tableContainer: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;
  readonly orderCount: Locator;

  // ── Sort Headers ──────────────────────────────────────────
  readonly sortOrderCode: Locator;
  readonly sortCustomer: Locator;
  readonly sortDate: Locator;
  readonly sortAmount: Locator;
  readonly sortStatus: Locator;

  // ── Pagination ────────────────────────────────────────────
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly paginationInfo: Locator;

  // ── Bulk Actions ──────────────────────────────────────────
  readonly selectAllCheckbox: Locator;
  readonly bulkDeleteBtn: Locator;
  readonly bulkStatusBtn: Locator;

  // ── Order Form (Checkout) ─────────────────────────────────
  readonly customerSelect: Locator;
  readonly productSearchInput: Locator;
  readonly addItemBtn: Locator;
  readonly submitOrderBtn: Locator;
  readonly cancelBtn: Locator;

  // ── Order Detail ──────────────────────────────────────────
  readonly orderCodeText: Locator;
  readonly orderStatusBadge: Locator;
  readonly totalAmountText: Locator;
  readonly itemsTable: Locator;
  readonly paymentSection: Locator;
  readonly activityLog: Locator;

  // ── Payment ───────────────────────────────────────────────
  readonly paymentAmountInput: Locator;
  readonly paymentMethodSelect: Locator;
  readonly recordPaymentBtn: Locator;

  // ── Status Update ─────────────────────────────────────────
  readonly updateStatusBtn: Locator;
  readonly confirmDialog: Locator;
  readonly confirmYesBtn: Locator;
  readonly confirmNoBtn: Locator;

  // ── Toast / Notifications ─────────────────────────────────
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.navOrders = page.getByRole("link", { name: /đơn hàng|orders/i });

    // Stats
    this.statsSection = page.locator("[class*='stats'], [class*='summary']").first();
    this.totalOrders = page.getByText(/tổng đơn hàng/i);

    // Filters
    this.searchInput = page.getByPlaceholder(/tìm kiếm|search|mã đơn/i);
    this.statusFilter = page.locator("select, [role='combobox']").first();
    this.dateRangeFilter = page.locator("[data-testid='date-range'], input[type='date']").first();

    // Order Table
    this.tableContainer = page.locator("table").first();
    this.tableRows = page.locator("tbody tr");
    this.emptyState = page.getByText(/không có đơn hàng nào|chưa có đơn hàng/i);
    this.orderCount = page.getByText(/đơn hàng$/);

    // Sort Headers
    this.sortOrderCode = page.locator("th").filter({ hasText: /mã đơn/i });
    this.sortCustomer = page.locator("th").filter({ hasText: /khách hàng/i });
    this.sortDate = page.locator("th").filter({ hasText: /ngày/i });
    this.sortAmount = page.locator("th").filter({ hasText: /số tiền|tổng/i });
    this.sortStatus = page.locator("th").filter({ hasText: /trạng thái/i });

    // Pagination
    this.paginationPrev = page.getByRole("button", { name: /trước/i });
    this.paginationNext = page.getByRole("button", { name: /tiếp/i });
    this.paginationInfo = page.locator("text=/Hiển thị .*/");

    // Bulk Actions
    this.selectAllCheckbox = page.locator("thead input[type='checkbox']");
    this.bulkDeleteBtn = page.getByRole("button", { name: /xóa|delete/i });
    this.bulkStatusBtn = page.getByRole("button", { name: /cập nhật trạng thái/i });

    // Order Form (Checkout)
    this.customerSelect = page.locator("[data-testid='customer-select'], select#customer");
    this.productSearchInput = page.getByPlaceholder(/tìm sản phẩm|search product/i);
    this.addItemBtn = page.getByRole("button", { name: /thêm|add/i });
    this.submitOrderBtn = page.getByRole("button", { name: /tạo đơn|submit|đặt hàng/i });
    this.cancelBtn = page.getByRole("button", { name: /hủy|cancel/i });

    // Order Detail
    this.orderCodeText = page.locator("[data-testid='order-code'], .order-code");
    this.orderStatusBadge = page.locator("[data-testid='order-status'], .status-badge");
    this.totalAmountText = page.locator("[data-testid='total-amount'], .total-amount");
    this.itemsTable = page.locator("[data-testid='order-items'] table, .order-items table");
    this.paymentSection = page.locator("[data-testid='payment-section'], .payment-section");
    this.activityLog = page.locator("[data-testid='activity-log'], .activity-log");

    // Payment
    this.paymentAmountInput = page.locator("input[name='amount'], [data-testid='payment-amount']");
    this.paymentMethodSelect = page.locator("[data-testid='payment-method'], select#payment-method");
    this.recordPaymentBtn = page.getByRole("button", { name: /thanh toán|record payment/i });

    // Status Update
    this.updateStatusBtn = page.getByRole("button", { name: /cập nhật|update status/i });
    this.confirmDialog = page.locator("[role='dialog'], .confirm-dialog");
    this.confirmYesBtn = page.locator("[role='dialog'] button").filter({ hasText: /xác nhận|yes|đồng ý/i });
    this.confirmNoBtn = page.locator("[role='dialog'] button").filter({ hasText: /hủy|no|cancel/i });

    // Toasts
    this.successToast = page.locator(".toast-success, [data-testid='success-toast']");
    this.errorToast = page.locator(".toast-error, [data-testid='error-toast']");
  }

  // ── Navigation Actions ───────────────────────────────────

  /** Navigate to orders list page */
  async goto() {
    await this.page.goto("/orders");
    await this.page.waitForLoadState("networkidle");
  }

  /** Navigate to specific order detail */
  async gotoOrderDetail(orderId: string) {
    await this.page.goto(`/orders/${orderId}`);
    await this.page.waitForLoadState("networkidle");
  }

  /** Navigate to create order page */
  async gotoCreateOrder() {
    await this.page.goto("/orders/new");
    await this.page.waitForLoadState("networkidle");
  }

  // ── Search & Filter ──────────────────────────────────────

  /** Search orders by text (order code, customer name) */
  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(300); // Debounce
  }

  /** Clear search */
  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /** Filter by status */
  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
    await this.page.waitForTimeout(300);
  }

  // ── Table ────────────────────────────────────────────────

  /** Wait for order table to load */
  async waitForTable() {
    await this.tableContainer.waitFor({ state: "visible", timeout: 10_000 });
  }

  /** Get number of visible table rows */
  async getVisibleRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  /** Get order codes from visible rows */
  async getVisibleOrderCodes(): Promise<string[]> {
    const rows = await this.tableRows.all();
    const codes: string[] = [];
    for (const row of rows) {
      const code = await row.locator("td:first-child, td:nth-child(2)").first().textContent();
      if (code) codes.push(code.trim());
    }
    return codes;
  }

  /** Sort by column */
  async sortBy(column: "orderCode" | "customer" | "date" | "amount" | "status") {
    const headers: Record<string, Locator> = {
      orderCode: this.sortOrderCode,
      customer: this.sortCustomer,
      date: this.sortDate,
      amount: this.sortAmount,
      status: this.sortStatus,
    };
    await headers[column].click();
    await this.page.waitForTimeout(200);
  }

  /** Click a specific order row */
  async clickOrderRow(orderCode: string) {
    const row = this.tableRows.filter({ hasText: orderCode });
    await row.click();
    await this.page.waitForLoadState("networkidle");
  }

  // ── Pagination ───────────────────────────────────────────

  async nextPage() {
    await this.paginationNext.click();
    await this.page.waitForTimeout(300);
  }

  async prevPage() {
    await this.paginationPrev.click();
    await this.page.waitForTimeout(300);
  }

  async getPaginationInfo(): Promise<string | null> {
    return this.paginationInfo.textContent();
  }

  // ── Bulk Actions ─────────────────────────────────────────

  async selectAll() {
    await this.selectAllCheckbox.click();
  }

  async toggleRowCheckbox(orderCode: string) {
    const row = this.tableRows.filter({ hasText: orderCode });
    const checkbox = row.locator("input[type='checkbox']");
    await checkbox.click();
  }

  async bulkDelete() {
    await this.bulkDeleteBtn.click();
  }

  // ── Checkout Form ────────────────────────────────────────

  /** Fill checkout form with customer and items */
  async fillCheckoutForm(options: {
    customerId: string;
    products: Array<{ name: string; quantity?: number }>;
  }) {
    // Select customer
    await this.customerSelect.selectOption(options.customerId);

    // Add products
    for (const product of options.products) {
      await this.productSearchInput.fill(product.name);
      await this.page.waitForTimeout(200);
      // Click search result
      await this.page.getByText(product.name).first().click();
      if (product.quantity && product.quantity > 1) {
        // Adjust quantity if needed
        const qtyInput = this.page.locator("input[type='number']").last();
        await qtyInput.fill(String(product.quantity));
      }
    }
  }

  /** Submit the checkout form */
  async submitOrder() {
    await this.submitOrderBtn.click();
    await this.page.waitForTimeout(500); // Wait for API response
  }

  // ── Order Detail Actions ─────────────────────────────────

  /** Get order status text */
  async getOrderStatus(): Promise<string | null> {
    return this.orderStatusBadge.textContent();
  }

  /** Get total amount text */
  async getTotalAmount(): Promise<string | null> {
    return this.totalAmountText.textContent();
  }

  /** Record a payment */
  async recordPayment(amount: number, method: string = "cash") {
    await this.paymentAmountInput.fill(String(amount));
    await this.paymentMethodSelect.selectOption(method);
    await this.recordPaymentBtn.click();
    await this.page.waitForTimeout(500);
  }

  /** Update order status via UI */
  async updateStatus(newStatus: string) {
    await this.updateStatusBtn.click();
    await this.page.getByText(newStatus).click();
    // Confirm dialog
    if (await this.confirmDialog.isVisible()) {
      await this.confirmYesBtn.click();
    }
    await this.page.waitForTimeout(500);
  }

  // ── Assertions Helpers ───────────────────────────────────

  /** Check if success toast is visible */
  async hasSuccessToast(): Promise<boolean> {
    return this.successToast.isVisible();
  }

  /** Check if error toast is visible */
  async hasErrorToast(): Promise<boolean> {
    return this.errorToast.isVisible();
  }

  /** Check if empty state is visible */
  async isEmptyStateVisible(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
