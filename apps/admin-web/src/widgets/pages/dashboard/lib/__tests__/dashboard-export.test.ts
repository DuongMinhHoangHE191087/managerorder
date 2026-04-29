import { describe, expect, it } from "vitest";
import type { DashboardStats } from "@/shared/types/dashboard";
import { buildDashboardExportData, buildDashboardPrintHtml } from "../dashboard-export";

const sampleStats = {
  totalRevenue: 1_250_000,
  totalCost: 550_000,
  totalProfit: 700_000,
  totalCollected: 900_000,
  totalDebt: 150_000,
  totalRefunded: 50_000,
  refundedCount: 1,
  pendingCount: 2,
  totalSlots: 20,
  usedSlots: 14,
  availableSlots: 6,
  fillRate: 70,
  expiringAccounts: [
    {
      id: "00000000-0000-4000-8000-000000000016",
      email: "alpha@example.com",
      expiresAt: "2026-04-25T10:00:00.000Z",
      daysLeft: 4,
      productIds: ["p1", "p2"],
      usedSlots: 4,
      maxSlots: 6,
    },
  ],
  overdueCustomers: [
    {
      id: "00000000-0000-4000-8000-0000000003fa",
      name: "Nguyễn A",
      debtAmountVnd: 150_000,
      debtOverdueDays: 12,
    },
  ],
  pendingOrders: [
    {
      id: "00000000-0000-4000-8000-00000000000f",
      customerId: "00000000-0000-4000-8000-0000000003fa",
      productId: "p1",
      totalAmountVnd: 250_000,
      createdAt: "2026-04-21T08:30:00.000Z",
      paymentState: "pending_payment",
      balanceDueVnd: 100_000,
    },
  ],
  topProducts: [
    {
      name: "Netflix",
      revenue: 850_000,
      count: 3,
    },
  ],
  productSlots: [
    {
      id: "p1",
      name: "Netflix",
      used: 4,
      max: 6,
    },
  ],
  chartData: [
    { name: "10/04", revenue: 500_000, cost: 200_000, orders: 2 },
    { name: "11/04", revenue: 750_000, cost: 350_000, orders: 4 },
  ],
  recentOrders: [
    {
      id: "00000000-0000-4000-8000-00000000000f",
      customerId: "00000000-0000-4000-8000-0000000003fa",
      customerName: "Nguyễn A",
      productId: "p1",
      productName: "Netflix",
      status: "paid",
      paymentState: "paid",
      balanceDueVnd: 0,
      totalAmountVnd: 250_000,
      createdAt: "2026-04-21T08:30:00.000Z",
    },
  ],
  calculatedAt: "2026-04-21T10:30:00.000Z",
} satisfies DashboardStats;

describe("buildDashboardExportData", () => {
  it("builds a multi-sheet dashboard workbook model", () => {
    const data = buildDashboardExportData(sampleStats, {
      days: 30,
      rangeLabel: "30 ngày",
    });

    expect(data.fileName).toMatch(/^dashboard-report-30d-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(data.sheets.map((sheet) => sheet.name)).toEqual([
      "Tổng quan",
      "Doanh thu & vốn",
      "Top sản phẩm",
      "Kho sản phẩm",
      "Đơn chờ",
      "Đơn gần đây",
      "Kho sắp hết hạn",
      "Công nợ quá hạn",
    ]);
  });

  it("maps revenue sheet with cost and margin", () => {
    const data = buildDashboardExportData(sampleStats, {
      days: 30,
      rangeLabel: "30 ngày",
    });

    const revenueSheet = data.sheets.find((sheet) => sheet.name === "Doanh thu & vốn");
    expect(revenueSheet).toBeDefined();
    expect(revenueSheet?.rows).toEqual([
      {
        period: "10/04",
        revenue: 500_000,
        cost: 200_000,
        profit: 300_000,
        orders: 2,
        margin: "60%",
      },
      {
        period: "11/04",
        revenue: 750_000,
        cost: 350_000,
        profit: 400_000,
        orders: 4,
        margin: "53%",
      },
    ]);
  });

  it("adds growth analytics sheets when data is available", () => {
    const data = buildDashboardExportData(
      {
        ...sampleStats,
        revenueForecast: [
          {
            horizonLabel: "30 ngày",
            days: 30,
            projectedRevenue: 1_800_000,
            confidence: 82,
            note: "Xu hướng đang tăng.",
          },
        ],
        cohortAnalysis: [
          {
            cohortLabel: "04/2026",
            acquiredCustomers: 12,
            returningCustomers: 4,
            revenue: 1_050_000,
            retentionRate: 33.3,
            churnRate: 66.7,
          },
        ],
        customerClv: [
          {
            customerId: "00000000-0000-4000-8000-0000000003fa",
            customerName: "Nguyễn A",
            totalRevenue: 2_400_000,
            totalProfit: 900_000,
            orderCount: 4,
            repeatRate: 75,
            clvScore: 1_950_000,
          },
        ],
      } satisfies DashboardStats,
      {
        days: 30,
        rangeLabel: "30 ngày",
      }
    );

    expect(data.sheets.map((sheet) => sheet.name)).toEqual([
      "Tổng quan",
      "Doanh thu & vốn",
      "Dự báo doanh thu",
      "Cohort retention",
      "CLV khách hàng",
      "Top sản phẩm",
      "Kho sản phẩm",
      "Đơn chờ",
      "Đơn gần đây",
      "Kho sắp hết hạn",
      "Công nợ quá hạn",
    ]);
  });

  it("builds printable html for PDF export", () => {
    const html = buildDashboardPrintHtml(sampleStats, {
      days: 30,
      rangeLabel: "30 ngày",
    });

    expect(html).toContain("Báo cáo dashboard ManagerOrder");
    expect(html).toContain("dashboard-report-30d-");
    expect(html).toContain("Tổng quan");
    expect(html).toContain("Doanh thu &amp; vốn");
    expect(html).toContain("window.print()");
  });
});
