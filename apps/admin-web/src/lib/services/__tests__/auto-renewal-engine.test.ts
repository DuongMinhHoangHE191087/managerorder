import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRenewalRequest: vi.fn(),
  loadRowsByIds: vi.fn(),
}));

function createSubscriptionBuilder(data: Record<string, unknown>[]) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };

  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/relation-fallback", () => ({
  loadRowsByIds: mocks.loadRowsByIds,
}));

vi.mock("@/lib/utils/subscriptions-helpers", () => ({
  createRenewalRequest: mocks.createRenewalRequest,
}));

import { supabaseAdmin } from "@/lib/supabase/admin";
import { runAutoRenewalEngine } from "../auto-renewal-engine";

describe("runAutoRenewalEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates renewal requests for expiring debt-free subscriptions", async () => {
    const expiryDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const subscriptions = [
      {
        id: "sub-1",
        account_id: "acc-1",
        customer_id: "cust-1",
        expiry_date: expiryDate,
        status: "active",
        renewal_status: "none",
        original_price: 120000,
        final_price: 120000,
        billing_cycle: "1month",
      },
    ];

    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(
      createSubscriptionBuilder(subscriptions),
    );
    mocks.loadRowsByIds.mockResolvedValue(
      new Map([
        [
          "cust-1",
          {
            id: "cust-1",
            full_name: "Nguyen Van A",
            debt_amount_vnd: 0,
            debt_overdue_days: 0,
            reliability_score: 88,
            segment: "loyal",
          },
        ],
      ]),
    );
    mocks.createRenewalRequest.mockResolvedValue({ id: "renew-1" });

    const report = await runAutoRenewalEngine({
      daysThreshold: 7,
      maxCreated: 10,
      minReliabilityScore: 70,
    });

    expect(report.createdCount).toBe(1);
    expect(report.skippedCount).toBe(0);
    expect(report.created[0]).toMatchObject({
      accountId: "acc-1",
      subscriptionId: "sub-1",
      renewalId: "renew-1",
      customerId: "cust-1",
      customerName: "Nguyen Van A",
    });
    expect(mocks.createRenewalRequest).toHaveBeenCalledWith("acc-1", "sub-1", "cust-1");
  });

  it("skips subscriptions when the customer still has debt", async () => {
    const expiryDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const subscriptions = [
      {
        id: "sub-2",
        account_id: "acc-1",
        customer_id: "cust-2",
        expiry_date: expiryDate,
        status: "active",
        renewal_status: "none",
        original_price: 120000,
        final_price: 120000,
        billing_cycle: "1month",
      },
    ];

    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(
      createSubscriptionBuilder(subscriptions),
    );
    mocks.loadRowsByIds.mockResolvedValue(
      new Map([
        [
          "cust-2",
          {
            id: "cust-2",
            full_name: "Tran Thi B",
            debt_amount_vnd: 50000,
            debt_overdue_days: 5,
            reliability_score: 92,
            segment: "at_risk",
          },
        ],
      ]),
    );

    const report = await runAutoRenewalEngine({
      daysThreshold: 7,
      maxCreated: 10,
      minReliabilityScore: 70,
    });

    expect(report.createdCount).toBe(0);
    expect(report.skippedCount).toBe(1);
    expect(report.skippedReasons.customer_has_debt).toBe(1);
    expect(mocks.createRenewalRequest).not.toHaveBeenCalled();
  });
});
