import type { Locator, Page } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;

  readonly kpiSection: Locator;
  readonly revenueCard: Locator;
  readonly profitCard: Locator;
  readonly ordersCard: Locator;
  readonly slotsCard: Locator;
  readonly pendingCard: Locator;

  readonly tabWeek: Locator;
  readonly tabMonth: Locator;
  readonly tabQuarter: Locator;
  readonly tabYear: Locator;

  readonly chartContainer: Locator;
  readonly chartSvg: Locator;
  readonly chartTooltip: Locator;
  readonly chartEmptyState: Locator;

  readonly alertsSection: Locator;
  readonly pendingAlert: Locator;
  readonly overdueAlert: Locator;
  readonly expiringAlert: Locator;

  readonly recentOrdersSection: Locator;
  readonly recentOrdersRows: Locator;
  readonly recentOrdersEmpty: Locator;

  readonly actionOrders: Locator;
  readonly actionCustomers: Locator;
  readonly actionProducts: Locator;
  readonly actionInventory: Locator;

  readonly refreshButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.kpiSection = page.locator("[class*='grid']").first();
    this.revenueCard = page.getByText(/doanh thu/i).first();
    this.profitCard = page.getByText(/lợi nhuận|loi nhuan/i).first();
    this.ordersCard = page.getByText(/đơn hàng|don hang/i).first();
    this.slotsCard = page.getByText(/slot|tài khoản|tai khoan/i).first();
    this.pendingCard = page.getByText(/chờ thanh toán|cho thanh toan/i).first();

    this.tabWeek = page.locator("[data-testid='dashboard-time-tab-7']").first();
    this.tabMonth = page.locator("[data-testid='dashboard-time-tab-30']").first();
    this.tabQuarter = page.locator("[data-testid='dashboard-time-tab-90']").first();
    this.tabYear = page.locator("[data-testid='dashboard-time-tab-365']").first();

    this.chartContainer = page.locator("[data-testid='dashboard-revenue-chart']").first();
    this.chartSvg = page.locator("[data-testid='dashboard-revenue-chart-svg']").first();
    this.chartTooltip = page.locator("[data-testid='dashboard-revenue-tooltip']").first();
    this.chartEmptyState = page.getByText(/chưa có doanh thu|không có dữ liệu|chua co doanh thu|khong co du lieu/i);

    this.alertsSection = page.locator("[data-testid='dashboard-alerts']").first();
    this.pendingAlert = page.locator("[data-testid='dashboard-pending-alert']").first();
    this.overdueAlert = page.locator("[data-testid='dashboard-overdue-alert']").first();
    this.expiringAlert = page.locator("[data-testid='dashboard-expiring-alert']").first();

    this.recentOrdersSection = page.locator("[data-testid='dashboard-recent-orders']").first();
    this.recentOrdersRows = page.locator("[data-testid='dashboard-recent-order-row']");
    this.recentOrdersEmpty = page.locator("[data-testid='dashboard-recent-orders-empty']").first();

    this.actionOrders = page.locator("[data-testid='dashboard-quick-action-orders-new']").first();
    this.actionCustomers = page.locator("[data-testid='dashboard-quick-action-customers']").first();
    this.actionProducts = page.locator("[data-testid='dashboard-quick-action-products']").first();
    this.actionInventory = page.locator("[data-testid='dashboard-quick-action-inventory']").first();

    this.refreshButton = page.locator("[data-testid='dashboard-refresh']").first();
  }

  async goto() {
    await this.page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await this.refreshButton.waitFor({ state: "visible", timeout: 60_000 });
  }

  async selectTimeRange(range: "week" | "month" | "quarter" | "year") {
    const tabs: Record<string, Locator> = {
      week: this.tabWeek,
      month: this.tabMonth,
      quarter: this.tabQuarter,
      year: this.tabYear,
    };
    await tabs[range].click();
    await this.page.waitForTimeout(500);
  }

  async showRevenueChart() {
    await this.page.locator("[data-testid='dashboard-revenue-section']").scrollIntoViewIfNeeded();
    await this.chartContainer.waitFor({ state: "visible", timeout: 120_000 });
    await this.chartContainer.scrollIntoViewIfNeeded();
  }

  async isChartVisible(): Promise<boolean> {
    await this.showRevenueChart();
    return this.chartSvg.isVisible();
  }

  async hoverChart(x: number, y: number) {
    await this.showRevenueChart();
    const box = await this.chartContainer.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + x, box.y + y);
      await this.page.waitForTimeout(200);
    }
  }

  async isTooltipVisible(): Promise<boolean> {
    return this.chartTooltip.isVisible();
  }

  async getKpiCardValues(): Promise<string[]> {
    const cards = this.page.locator("[data-testid='dashboard-kpi-value']");
    const values: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (text) values.push(text.trim());
    }
    return values;
  }

  async hasPendingAlert(): Promise<boolean> {
    return this.pendingAlert.isVisible();
  }

  async hasOverdueAlert(): Promise<boolean> {
    return this.overdueAlert.isVisible();
  }

  async hasExpiringAlert(): Promise<boolean> {
    return this.expiringAlert.isVisible();
  }

  async showRecentOrders() {
    await this.page.locator("[data-testid='dashboard-recent-orders-section']").scrollIntoViewIfNeeded();
    await this.recentOrdersSection.waitFor({ state: "visible", timeout: 30_000 }).catch(() => null);
    if (await this.recentOrdersSection.count()) {
      await this.recentOrdersSection.scrollIntoViewIfNeeded();
    }
  }

  async getRecentOrderCount(): Promise<number> {
    await this.showRecentOrders();
    if (!(await this.recentOrdersSection.count())) {
      return 0;
    }
    return this.recentOrdersRows.count();
  }

  async isRecentOrdersEmpty(): Promise<boolean> {
    await this.showRecentOrders();
    if (!(await this.recentOrdersSection.count())) {
      return true;
    }
    return this.recentOrdersEmpty.isVisible();
  }

  async refresh() {
    await this.refreshButton.click();
    await this.page.waitForTimeout(500);
  }

  async setViewport(width: number, height: number) {
    await this.page.setViewportSize({ width, height });
    await this.page.waitForTimeout(300);
  }
}
