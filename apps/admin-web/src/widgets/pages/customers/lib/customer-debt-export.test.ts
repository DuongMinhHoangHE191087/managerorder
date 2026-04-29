import { describe, expect, it } from "vitest";
import { buildCustomerDebtSummaryCsv } from "./customer-debt-export";
import type { CustomerStatsDashboardModel } from "./customer-stats-dashboard";

const model: CustomerStatsDashboardModel = {
  typeBars: [],
  totalDebt: 900000,
  customersWithDebt: 2,
  overdueCount: 1,
  avgDebt: 450000,
  avgReliabilityScore: 84,
  topDebtors: [
    {
      id: "00000000-0000-4000-8000-00000000005c",
      name: "Tran Thi B",
      debtAmountVnd: 500000,
      overdueDays: 12,
      segment: "at_risk",
    },
  ],
  agingBuckets: [
    { key: "current", label: "Chưa quá hạn", amount: 200000, percent: 22, color: "#0f766e" },
    { key: "days_1_30", label: "1-30 ngày", amount: 300000, percent: 33, color: "#2563eb" },
  ],
  segmentBreakdown: [
    { segment: "Có rủi ro", count: 1, totalDebt: 500000, share: 56 },
    { segment: "Trung thành", count: 1, totalDebt: 400000, share: 44 },
  ],
};

describe("buildCustomerDebtSummaryCsv", () => {
  it("exports a structured CSV snapshot for debt dashboard data", () => {
    const csv = buildCustomerDebtSummaryCsv(model);

    expect(csv).toContain("summary,totalDebtVnd,900000");
    expect(csv).toContain("aging,1-30 ngày,300000,33%");
    expect(csv).toContain("top_debtor,1,Tran Thi B,500000,12,at_risk");
    expect(csv).toContain("segment,Có rủi ro,1,500000,56%");
  });
});
