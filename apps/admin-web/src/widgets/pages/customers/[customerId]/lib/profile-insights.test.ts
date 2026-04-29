import { describe, expect, it } from "vitest";
import type { CustomerOrder } from "@/shared/types/customers";
import type { Customer360Stats } from "@/widgets/pages/customers/hooks/use-customers";
import { buildCustomerProfileInsights } from "./profile-insights";

function buildOrder(overrides: Partial<CustomerOrder>): CustomerOrder {
  return {
    id: "00000000-0000-4000-8000-00000000005b",
    status: "paid",
    payment_method: "bank_transfer",
    payment_terms: "paid",
    payment_state: "paid",
    balance_due_vnd: 0,
    is_fully_paid: true,
    total_amount: 100000,
    total_paid: 100000,
    items: [{ productName: "Netflix", quantity: 1 }],
    created_at: "2026-04-20T00:00:00.000Z",
    ...overrides,
  };
}

function buildStats(overrides: Partial<Customer360Stats>): Customer360Stats {
  return {
    customerId: "00000000-0000-4000-8000-00000000005c",
    totalOrders: 3,
    totalSpentVnd: 900000,
    avgOrderValueVnd: 300000,
    firstOrderDate: "2026-03-01T00:00:00.000Z",
    lastOrderDate: "2026-04-20T00:00:00.000Z",
    ordersByStatus: {
      paid: 1,
      pending_payment: 1,
      provisioning: 1,
    },
    totalPaymentsVnd: 350000,
    outstandingDebtVnd: 550000,
    segment: "loyal",
    rfmScore: 80,
    rfmRecency: 4,
    rfmFrequency: 4,
    rfmMonetary: 5,
    lastRfmCalculatedAt: "2026-04-21T00:00:00.000Z",
    debtAmountVnd: 550000,
    debtOverdueDays: 12,
    reliabilityScore: 82,
    ...overrides,
  };
}

describe("buildCustomerProfileInsights", () => {
  it("prioritizes debt follow-up and open pipeline review when the customer still owes money", () => {
    const insights = buildCustomerProfileInsights({
      customerId: "00000000-0000-4000-8000-00000000005c",
      customerName: "Nguyen Van A",
      stats: buildStats({}),
      orders: [
        buildOrder({
          id: "00000000-0000-4000-8000-00000000005b",
          status: "pending_payment",
          total_amount: 400000,
          total_paid: 100000,
          created_at: "2026-04-20T00:00:00.000Z",
        }),
        buildOrder({
          id: "00000000-0000-4000-8000-0000000000c5",
          status: "provisioning",
          total_amount: 300000,
          total_paid: 250000,
          created_at: "2026-04-15T00:00:00.000Z",
        }),
        buildOrder({
          id: "00000000-0000-4000-8000-000000000175",
          status: "paid",
          total_amount: 200000,
          total_paid: 200000,
          created_at: "2026-03-15T00:00:00.000Z",
        }),
      ],
    });

    expect(insights.collectionRate).toBe(39);
    expect(insights.activeDebtOrders).toBe(2);
    expect(insights.nextActions.map((action) => action.id)).toEqual([
      "debt-follow-up",
      "order-ops-review",
    ]);
    expect(insights.statusBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "paid",
          count: 1,
        }),
      ]),
    );
  });

  it("recommends re-engagement when the customer has gone cold", () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const insights = buildCustomerProfileInsights({
      customerId: "00000000-0000-4000-8000-00000000005c",
      customerName: "Nguyen Van A",
      stats: buildStats({
        totalSpentVnd: 400000,
        totalPaymentsVnd: 400000,
        debtAmountVnd: 0,
        debtOverdueDays: 0,
        lastOrderDate: sixtyDaysAgo,
        ordersByStatus: { paid: 2 },
      }),
      orders: [
        buildOrder({
          id: "00000000-0000-4000-8000-00000000005b",
          created_at: sixtyDaysAgo,
        }),
        buildOrder({
          id: "00000000-0000-4000-8000-0000000000c5",
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ],
    });

    expect(insights.nextActions.map((action) => action.id)).toContain("reengage-customer");
    expect(insights.recentOrders30d).toBe(0);
    expect(insights.averageDaysBetweenOrders).toBeGreaterThan(20);
  });

  it("falls back to a stable profile action when there is no debt or pipeline risk", () => {
    const insights = buildCustomerProfileInsights({
      customerId: "00000000-0000-4000-8000-00000000005c",
      customerName: "Nguyen Van A",
      stats: buildStats({
        totalSpentVnd: 500000,
        totalPaymentsVnd: 500000,
        debtAmountVnd: 0,
        debtOverdueDays: 0,
        ordersByStatus: { paid: 2, completed: 1 },
      }),
      orders: [
        buildOrder({
          id: "00000000-0000-4000-8000-00000000005b",
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ],
    });

    expect(insights.collectionRate).toBe(100);
    expect(insights.nextActions).toEqual([
      expect.objectContaining({
        id: "stable-profile",
        tone: "neutral",
      }),
    ]);
  });
});
