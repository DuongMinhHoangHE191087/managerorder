import { describe, expect, it } from "vitest";
import type { Customer } from "@/lib/domain/types";
import type { DebtSummary } from "@/widgets/pages/customers/hooks/use-customers";
import {
  buildCustomerStatsDashboardModel,
  formatSegmentLabel,
} from "./customer-stats-dashboard";

function buildCustomer(overrides: Partial<Customer>): Customer {
  return {
    id: "00000000-0000-4000-8000-00000000005c",
    name: "Nguyen Van A",
    contacts: [],
    tier: "regular",
    customerType: "retail",
    debtAmountVnd: 0,
    debtOverdueDays: 0,
    reliabilityScore: 100,
    createdAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildDebtSummary(overrides: Partial<DebtSummary>): DebtSummary {
  return {
    totalDebtVnd: 900000,
    totalCustomers: 3,
    customersWithDebt: 2,
    overdueCustomers: 1,
    avgReliabilityScore: 84,
    aging: {
      current: 200000,
      days_1_30: 300000,
      days_31_60: 250000,
      days_61_90: 100000,
      days_90_plus: 50000,
    },
    topDebtors: [
      {
        id: "00000000-0000-4000-8000-000000000171",
        name: "Tran Thi B",
        debtAmountVnd: 500000,
        overdueDays: 35,
        segment: "at_risk",
      },
    ],
    segmentBreakdown: {
      loyal: { count: 1, totalDebt: 400000 },
      at_risk: { count: 2, totalDebt: 500000 },
    },
    ...overrides,
  };
}

describe("buildCustomerStatsDashboardModel", () => {
  it("prefers backend debt summary when available", () => {
    const model = buildCustomerStatsDashboardModel({
      customers: [
        buildCustomer({ id: "00000000-0000-4000-8000-00000000005c", customerType: "retail" }),
        buildCustomer({ id: "00000000-0000-4000-8000-000000000171", customerType: "wholesale", debtAmountVnd: 200000 }),
        buildCustomer({ id: "00000000-0000-4000-8000-000000000172", customerType: "agency", debtAmountVnd: 100000 }),
      ],
      debtSummary: buildDebtSummary({}),
    });

    expect(model.totalDebt).toBe(900000);
    expect(model.customersWithDebt).toBe(2);
    expect(model.avgReliabilityScore).toBe(84);
    expect(model.topDebtors[0]?.id).toBe("00000000-0000-4000-8000-000000000171");
    expect(model.agingBuckets.find((bucket) => bucket.key === "days_1_30")?.amount).toBe(300000);
    expect(model.segmentBreakdown[0]).toEqual(
      expect.objectContaining({
        segment: "Có rủi ro",
        totalDebt: 500000,
        share: 56,
      }),
    );
  });

  it("falls back to local customer debt data when no backend summary is loaded", () => {
    const model = buildCustomerStatsDashboardModel({
      customers: [
        buildCustomer({
          id: "00000000-0000-4000-8000-00000000005c",
          name: "Nguyen Van A",
          customerType: "retail",
          debtAmountVnd: 100000,
          debtOverdueDays: 0,
          segment: "regular",
        }),
        buildCustomer({
          id: "00000000-0000-4000-8000-000000000171",
          name: "Tran Thi B",
          customerType: "retail",
          debtAmountVnd: 250000,
          debtOverdueDays: 45,
          segment: "vip",
        }),
      ],
    });

    expect(model.totalDebt).toBe(350000);
    expect(model.customersWithDebt).toBe(2);
    expect(model.overdueCount).toBe(1);
    expect(model.avgDebt).toBe(175000);
    expect(model.topDebtors[0]).toEqual(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000171",
        debtAmountVnd: 250000,
      }),
    );
    expect(model.agingBuckets.find((bucket) => bucket.key === "days_31_60")?.amount).toBe(250000);
  });
});

describe("formatSegmentLabel", () => {
  it("formats known and unknown segment names", () => {
    expect(formatSegmentLabel("vip")).toBe("VIP");
    expect(formatSegmentLabel("at_risk")).toBe("Có rủi ro");
    expect(formatSegmentLabel("new_segment")).toBe("new segment");
  });
});
