import type { Locator, Page } from "@playwright/test";

export class OrderCheckoutPage {
  readonly page: Page;
  readonly navOrders: Locator;
  readonly statsSection: Locator;
  readonly totalOrders: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly dateRangeFilter: Locator;
  readonly tableContainer: Locator;
  readonly tableRows: Locator;
  readonly emptyState: Locator;
  readonly orderCount: Locator;
  readonly sortOrderCode: Locator;
  readonly sortCustomer: Locator;
  readonly sortDate: Locator;
  readonly sortAmount: Locator;
  readonly sortStatus: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly paginationInfo: Locator;
  readonly selectAllCheckbox: Locator;
  readonly bulkDeleteBtn: Locator;
  readonly bulkStatusBtn: Locator;
  readonly customerSelect: Locator;
  readonly productSearchInput: Locator;
  readonly addItemBtn: Locator;
  readonly submitOrderBtn: Locator;
  readonly cancelBtn: Locator;
  readonly orderCodeText: Locator;
  readonly orderStatusBadge: Locator;
  readonly totalAmountText: Locator;
  readonly itemsTable: Locator;
  readonly paymentSection: Locator;
  readonly activityLog: Locator;
  readonly paymentAmountInput: Locator;
  readonly paymentMethodSelect: Locator;
  readonly recordPaymentBtn: Locator;
  readonly updateStatusBtn: Locator;
  readonly confirmDialog: Locator;
  readonly confirmYesBtn: Locator;
  readonly confirmNoBtn: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navOrders = page.getByRole("link", { name: /đơn hàng|orders/i }).first();
    this.statsSection = page.locator("[class*='stats'], [class*='summary']").first();
    this.totalOrders = page.getByText(/tổng đơn hàng/i).first();
    this.searchInput = page.getByPlaceholder(/tìm kiếm|search|mã đơn/i).first();
    this.statusFilter = page.locator("select, [role='combobox']").first();
    this.dateRangeFilter = page.locator("[data-testid='date-range'], input[type='date']").first();
    this.tableContainer = page.locator("[data-testid='orders-list'], table").first();
    this.tableRows = page.locator("[data-testid='order-row'], tbody tr");
    this.emptyState = page.locator("[data-testid='orders-empty-state']").or(page.getByText(/không tìm thấy đơn hàng|không có đơn hàng nào|chưa có đơn hàng/i)).first();
    this.orderCount = page.getByText(/đơn hàng$/i).first();
    this.sortOrderCode = page.locator("[data-testid='orders-sort-code'], th").filter({ hasText: /mã đơn/i }).first();
    this.sortCustomer = page.locator("[data-testid='orders-sort-customer'], th").filter({ hasText: /khách hàng/i }).first();
    this.sortDate = page.locator("[data-testid='orders-sort-date'], th").filter({ hasText: /ngày/i }).first();
    this.sortAmount = page.locator("[data-testid='orders-sort-amount'], th").filter({ hasText: /số tiền|tổng/i }).first();
    this.sortStatus = page.locator("[data-testid='orders-sort-status'], th").filter({ hasText: /trạng thái/i }).first();
    this.paginationPrev = page.locator("[data-testid='orders-prev-page']").or(page.getByRole("button", { name: /trước/i })).first();
    this.paginationNext = page.locator("[data-testid='orders-next-page']").or(page.getByRole("button", { name: /tiếp/i })).first();
    this.paginationInfo = page.locator("[data-testid='orders-pagination-info']").first();
    this.selectAllCheckbox = page.locator("[data-testid='orders-select-all'], thead input[type='checkbox']").first();
    this.bulkDeleteBtn = page.getByRole("button", { name: /xóa|delete/i }).first();
    this.bulkStatusBtn = page.getByRole("button", { name: /cập nhật trạng thái/i }).first();
    this.customerSelect = page.locator("[data-testid='customer-select'], select#customer").first();
    this.productSearchInput = page.getByPlaceholder(/tìm sản phẩm|search product/i).first();
    this.addItemBtn = page.getByRole("button", { name: /thêm|add/i }).first();
    this.submitOrderBtn = page.getByRole("button", { name: /tạo đơn|submit|đặt hàng/i }).first();
    this.cancelBtn = page.getByRole("button", { name: /hủy|cancel/i }).first();
    this.orderCodeText = page.locator("[data-testid='order-code'], .order-code").first();
    this.orderStatusBadge = page.locator("[data-testid='order-status'], .status-badge").first();
    this.totalAmountText = page.locator("[data-testid='total-amount'], .total-amount").first();
    this.itemsTable = page.locator("[data-testid='order-items'] table, .order-items table").first();
    this.paymentSection = page.locator("[data-testid='payment-section'], .payment-section").first();
    this.activityLog = page.locator("[data-testid='activity-log'], .activity-log").first();
    this.paymentAmountInput = page.locator("input[name='amount'], [data-testid='payment-amount']").first();
    this.paymentMethodSelect = page.locator("[data-testid='payment-method'], select#payment-method").first();
    this.recordPaymentBtn = page.getByRole("button", { name: /thanh toán|record payment/i }).first();
    this.updateStatusBtn = page.getByRole("button", { name: /cập nhật|update status/i }).first();
    this.confirmDialog = page.locator("[role='dialog'], .confirm-dialog").first();
    this.confirmYesBtn = page.locator("[role='dialog'] button").filter({ hasText: /xác nhận|yes|đồng ý/i }).first();
    this.confirmNoBtn = page.locator("[role='dialog'] button").filter({ hasText: /hủy|no|cancel/i }).first();
    this.successToast = page.locator(".toast-success, [data-testid='success-toast']").first();
    this.errorToast = page.locator(".toast-error, [data-testid='error-toast']").first();
  }

  async goto() {
    await this.page.goto("/orders", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await this.page.getByRole("heading", { name: /đơn hàng|orders/i }).first().waitFor({ state: "visible", timeout: 20_000 });
  }

  async gotoOrderDetail(orderId: string) {
    const responsePromise = this.page
      .waitForResponse((response) => response.url().includes(`/api/orders/${orderId}`) && response.status() < 500, { timeout: 15_000 })
      .catch(() => null);
    await this.page.goto(`/orders/${orderId}`, { waitUntil: "domcontentloaded" });
    await responsePromise;
  }

  async gotoCreateOrder() {
    await this.page.goto("/orders/new", { waitUntil: "domcontentloaded" });
    await this.page.getByRole("heading", { name: /tạo đơn|đơn hàng|checkout/i }).first().waitFor({ state: "visible", timeout: 20_000 });
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(850);
  }

  async clearSearch() {
    await this.searchInput.clear();
    await this.page.waitForTimeout(850);
  }

  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
    await this.page.waitForTimeout(500);
  }

  async waitForTable() {
    await this.searchInput.waitFor({ state: "visible", timeout: 20_000 });
    await this.tableContainer.waitFor({ state: "visible", timeout: 20_000 });
    await this.waitForListReady();
  }

  async waitForListReady() {
    await this.page.waitForFunction(
      () =>
        document.querySelectorAll("[data-testid='order-row'], tbody tr").length > 0 ||
        Boolean(document.querySelector("[data-testid='orders-empty-state']")) ||
        Boolean(document.querySelector("[data-testid='orders-pagination']")),
      undefined,
      { timeout: 60_000 },
    );
  }

  async waitForRowsAtLeast(count: number) {
    await this.page.waitForFunction(
      (minimum) => document.querySelectorAll("[data-testid='order-row'], tbody tr").length >= minimum,
      count,
      { timeout: 20_000 },
    );
  }

  async getVisibleRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  async getVisibleOrderCodes(): Promise<string[]> {
    return this.tableRows.evaluateAll((rows) =>
      rows
        .map((row) => row.getAttribute("data-order-code") ?? row.querySelector("[data-testid='order-code']")?.textContent?.trim() ?? "")
        .map((code) => code.replace(/^#/, "").trim())
        .filter(Boolean),
    );
  }

  async sortBy(column: "orderCode" | "customer" | "date" | "amount" | "status") {
    const headers: Record<string, Locator> = {
      orderCode: this.sortOrderCode,
      customer: this.sortCustomer,
      date: this.sortDate,
      amount: this.sortAmount,
      status: this.sortStatus,
    };
    if ((await headers[column].count()) === 0) return;
    await headers[column].click({ timeout: 2_000 });
    await this.page.waitForTimeout(200);
  }

  async clickOrderRow(orderCode: string) {
    const matchingRow = this.tableRows.filter({ hasText: orderCode }).first();
    await matchingRow.scrollIntoViewIfNeeded();
    const orderId = await matchingRow.getAttribute("data-order-id");
    await matchingRow.click();
    await this.page.waitForURL(/\/orders\/[^/]+$/, { timeout: 10_000 }).catch(async () => {
      if (orderId) {
        await this.page.goto(`/orders/${orderId}`, { waitUntil: "domcontentloaded" });
      }
    });
  }

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

  async selectAll() {
    await this.selectAllCheckbox.click();
  }

  async toggleRowCheckbox(orderCode: string) {
    await this.tableRows.filter({ hasText: orderCode }).first().locator("input[type='checkbox'], button").first().click();
  }

  async bulkDelete() {
    await this.bulkDeleteBtn.click();
  }

  async fillCheckoutForm(options: { customerId: string; products: Array<{ name: string; quantity?: number }> }) {
    await this.customerSelect.selectOption(options.customerId);
    for (const product of options.products) {
      await this.productSearchInput.fill(product.name);
      await this.page.waitForTimeout(200);
      await this.page.getByText(product.name).first().click();
      if (product.quantity && product.quantity > 1) {
        await this.page.locator("input[type='number']").last().fill(String(product.quantity));
      }
    }
  }

  async submitOrder() {
    await this.submitOrderBtn.click();
    await this.page.waitForTimeout(500);
  }

  async getOrderStatus(): Promise<string | null> {
    return this.orderStatusBadge.textContent();
  }

  async getTotalAmount(): Promise<string | null> {
    return this.totalAmountText.textContent();
  }

  async recordPayment(amount: number, method = "cash") {
    await this.paymentAmountInput.fill(String(amount));
    await this.paymentMethodSelect.selectOption(method);
    await this.recordPaymentBtn.click();
    await this.page.waitForTimeout(500);
  }

  async updateStatus(newStatus: string) {
    await this.updateStatusBtn.click();
    await this.page.getByText(newStatus).click();
    if (await this.confirmDialog.isVisible()) await this.confirmYesBtn.click();
    await this.page.waitForTimeout(500);
  }

  async hasSuccessToast(): Promise<boolean> {
    return this.successToast.isVisible();
  }

  async hasErrorToast(): Promise<boolean> {
    return this.errorToast.isVisible();
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return this.emptyState.isVisible();
  }
}
