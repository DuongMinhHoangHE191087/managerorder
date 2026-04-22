/**
 * ============================================================
 * PAGE OBJECT MODEL — Dashboard Page
 *
 * Encapsulates all UI interactions for the Dashboard module.
 * Follows POM pattern matching existing inventory-page.ts style.
 * ============================================================
 */
import type { Page, Locator } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;

  // ── KPI Cards ─────────────────────────────────────────────
  readonly kpiSection: Locator;
  readonly revenueCard: Locator;
  readonly profitCard: Locator;
  readonly ordersCard: Locator;
  readonly slotsCard: Locator;
  readonly pendingCard: Locator;

  // ── Time Range Tabs ───────────────────────────────────────
  readonly tabWeek: Locator;
  readonly tabMonth: Locator;
  readonly tabQuarter: Locator;
  readonly tabYear: Locator;

  // ── Revenue Chart ─────────────────────────────────────────
  readonly chartContainer: Locator;
  readonly chartSvg: Locator;
  readonly chartTooltip: Locator;
  readonly chartEmptyState: Locator;

  // ── Alerts Section ────────────────────────────────────────
  readonly alertsSection: Locator;
  readonly pendingAlert: Locator;
  readonly overdueAlert: Locator;
  readonly expiringAlert: Locator;

  // ── Recent Orders Table ───────────────────────────────────
  readonly recentOrdersSection: Locator;
  readonly recentOrdersRows: Locator;
  readonly recentOrdersEmpty: Locator;

  // ── Quick Actions ─────────────────────────────────────────
  readonly actionOrders: Locator;
  readonly actionCustomers: Locator;
  readonly actionProducts: Locator;
  readonly actionInventory: Locator;

  // ── Refresh Button ────────────────────────────────────────
  readonly refreshButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // KPI section
    this.kpiSection = page.locator("[class*='grid']").first();
    this.revenueCard = page.getByText(/doanh thu/i).first();
    this.profitCard = page.getByText(/lợi nhuận/i).first();
    this.ordersCard = page.getByText(/đơn hàng/i).first();
    this.slotsCard = page.getByText(/slot|tài khoản/i).first();
    this.pendingCard = page.getByText(/chờ thanh toán/i).first();

    // Time range tabs
    this.tabWeek = page.getByRole("tab", { name: /tuần|7 ngày/i });
    this.tabMonth = page.getByRole("tab", { name: /tháng|30 ngày/i });
    this.tabQuarter = page.getByRole("tab", { name: /quý|90 ngày/i });
    this.tabYear = page.getByRole("tab", { name: /năm|365 ngày/i });

    // Chart
    this.chartContainer = page.locator("[class*='chart'], .recharts-responsive-container").first();
    this.chartSvg = page.locator(".recharts-surface, svg.recharts-surface").first();
    this.chartTooltip = page.locator(".recharts-tooltip-wrapper");
    this.chartEmptyState = page.getByText(/chưa có doanh thu|không có dữ liệu/i);

    // Alerts
    this.alertsSection = page.locator("[class*='alert']").first();
    this.pendingAlert = page.getByText(/đơn hàng chờ/i);
    this.overdueAlert = page.getByText(/khách hàng quá hạn|nợ quá hạn/i);
    this.expiringAlert = page.getByText(/sắp hết hạn/i);

    // Recent orders
    this.recentOrdersSection = page.getByText(/đơn hàng gần đây/i).locator("..");
    this.recentOrdersRows = page.locator("table tbody tr, [class*='recent'] [class*='row']");
    this.recentOrdersEmpty = page.getByText(/không có đơn hàng/i);

    // Quick actions
    this.actionOrders = page.getByRole("link", { name: /quản lý đơn hàng|đơn hàng/i });
    this.actionCustomers = page.getByRole("link", { name: /khách hàng/i });
    this.actionProducts = page.getByRole("link", { name: /sản phẩm/i });
    this.actionInventory = page.getByRole("link", { name: /kho hàng|inventory/i });

    // Refresh
    this.refreshButton = page.getByRole("button", { name: /làm mới|refresh/i });
  }

  // ── Navigation ────────────────────────────────────────────

  async goto() {
    await this.page.goto("/dashboard");
    await this.page.waitForLoadState("networkidle");
  }

  // ── Time Range Actions ────────────────────────────────────

  async selectTimeRange(range: "week" | "month" | "quarter" | "year") {
    const tabs: Record<string, Locator> = {
      week: this.tabWeek,
      month: this.tabMonth,
      quarter: this.tabQuarter,
      year: this.tabYear,
    };
    await tabs[range].click();
    await this.page.waitForTimeout(500); // Wait for data refresh
  }

  // ── Chart Interactions ────────────────────────────────────

  async isChartVisible(): Promise<boolean> {
    return this.chartSvg.isVisible();
  }

  async hoverChart(x: number, y: number) {
    const box = await this.chartContainer.boundingBox();
    if (box) {
      await this.page.mouse.move(box.x + x, box.y + y);
      await this.page.waitForTimeout(200);
    }
  }

  async isTooltipVisible(): Promise<boolean> {
    return this.chartTooltip.isVisible();
  }

  // ── KPI Actions ───────────────────────────────────────────

  async getKpiCardValues(): Promise<string[]> {
    const cards = this.page.locator("[class*='card'] [class*='value'], [class*='kpi'] [class*='number']");
    const values: string[] = [];
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const text = await cards.nth(i).textContent();
      if (text) values.push(text.trim());
    }
    return values;
  }

  // ── Alerts ────────────────────────────────────────────────

  async hasPendingAlert(): Promise<boolean> {
    return this.pendingAlert.isVisible();
  }

  async hasOverdueAlert(): Promise<boolean> {
    return this.overdueAlert.isVisible();
  }

  async hasExpiringAlert(): Promise<boolean> {
    return this.expiringAlert.isVisible();
  }

  // ── Recent Orders ─────────────────────────────────────────

  async getRecentOrderCount(): Promise<number> {
    return this.recentOrdersRows.count();
  }

  async isRecentOrdersEmpty(): Promise<boolean> {
    return this.recentOrdersEmpty.isVisible();
  }

  // ── Refresh ───────────────────────────────────────────────

  async refresh() {
    await this.refreshButton.click();
    await this.page.waitForLoadState("networkidle");
  }

  // ── Responsive ────────────────────────────────────────────

  async setViewport(width: number, height: number) {
    await this.page.setViewportSize({ width, height });
    await this.page.waitForTimeout(300);
  }
}
