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
        id: "00000000-0000-4000-8000-000000000017",
        account_id: "00000000-0000-4000-8000-000000000016",
        customer_id: "00000000-0000-4000-8000-000000000005",
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
          "00000000-0000-4000-8000-000000000005",
          {
            id: "00000000-0000-4000-8000-000000000005",
            full_name: "Nguyen Van A",
            debt_amount_vnd: 0,
            debt_overdue_days: 0,
            reliability_score: 88,
            segment: "loyal",
          },
        ],
      ]),
    );
    mocks.createRenewalRequest.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000018" });

    const report = await runAutoRenewalEngine({
      daysThreshold: 7,
      maxCreated: 10,
      minReliabilityScore: 70,
    });

    expect(report.createdCount).toBe(1);
    expect(report.skippedCount).toBe(0);
    expect(report.created[0]).toMatchObject({
      accountId: "00000000-0000-4000-8000-000000000016",
      subscriptionId: "00000000-0000-4000-8000-000000000017",
      renewalId: "00000000-0000-4000-8000-000000000018",
      customerId: "00000000-0000-4000-8000-000000000005",
      customerName: "Nguyen Van A",
    });
    expect(mocks.createRenewalRequest).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000016", "00000000-0000-4000-8000-000000000017", "00000000-0000-4000-8000-000000000005");
  });

  it("skips subscriptions when the customer still has debt", async () => {
    const expiryDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const subscriptions = [
      {
        id: "00000000-0000-4000-8000-00000000008d",
        account_id: "00000000-0000-4000-8000-000000000016",
        customer_id: "00000000-0000-4000-8000-000000000006",
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
          "00000000-0000-4000-8000-000000000006",
          {
            id: "00000000-0000-4000-8000-000000000006",
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
