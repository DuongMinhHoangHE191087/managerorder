import { describe, expect, it, vi } from "vitest";

import {
  TEST_ACCOUNT_ID,
  createTestRequest,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

const PREMIUM_RENEWAL_ROUTE_TIMEOUT_MS = 20_000;

function createSingleBuilder<T>(result: { data: T | null; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
  };

  return chain;
}

async function loadRoute(routePath: string, mocks: Record<string, unknown>) {
  vi.resetModules();
  vi.doMock("@/lib/api/with-account", () => mockWithAccount());
  vi.doMock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
  vi.doMock("@/lib/supabase/admin", () => ({ supabaseAdmin: mocks.supabaseAdmin }));
  if (mocks.subscriptionsHelpers) {
    vi.doMock("@/lib/utils/subscriptions-helpers", () => ({
      ...(mocks.subscriptionsHelpers as Record<string, unknown>),
    }));
  }

  return import(routePath);
}

describe("premium renewal finance contracts", () => {
  it("PUT /api/premium/subscriptions/[id]/renew forwards cycle and finance fields", async () => {
    const subscriptionBuilder = createSingleBuilder({
      data: {
        id: "00000000-0000-4000-8000-000000000017",
        customer_id: "00000000-0000-4000-8000-000000000005",
        premium_account_id: "00000000-0000-4000-8000-000000000016",
        status: "active",
        renewal_status: "none",
        expiry_date: "2026-07-01",
        billing_cycle: "3months",
        cycle_months: 3,
        final_price: 150000,
        original_price: 150000,
      },
      error: null,
    });
    const renewalBuilder = createSingleBuilder({
      data: {
        id: "00000000-0000-4000-8000-000000000075",
        status: "pending",
        account_id: TEST_ACCOUNT_ID,
        original_subscription_id: "00000000-0000-4000-8000-000000000017",
      },
      error: null,
    });
    const hydratedSubscriptionBuilder = createSingleBuilder({
      data: {
        id: "00000000-0000-4000-8000-000000000017",
        billing_cycle: "3months",
        original_price: 150000,
        final_price: 150000,
        start_date: "2026-04-01",
        expiry_date: "2026-07-01",
      },
      error: null,
    });
    const createRenewalRequest = vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000075" });

    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === "customer_premium_subscriptions") {
          if (supabaseAdmin.from.mock.calls.filter(([name]) => name === table).length === 1) {
            return subscriptionBuilder;
          }
          return hydratedSubscriptionBuilder;
        }
        if (table === "subscription_renewals") {
          return renewalBuilder;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const { PUT } = await loadRoute("@/app/api/premium/subscriptions/[id]/renew/route", {
      supabaseAdmin,
      subscriptionsHelpers: {
        createRenewalRequest,
      },
    });

    const response = await PUT(
      createTestRequest("http://localhost/api/premium/subscriptions/00000000-0000-4000-8000-000000000017/renew", {
        method: "PUT",
        body: {
          renewal_price: 210000,
          new_billing_cycle: "6months",
          cost_price: 120000,
          collected_amount: 150000,
          notes: "Khách cọc trước 150k",
        },
      }),
      { params: { id: "00000000-0000-4000-8000-000000000017" } } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createRenewalRequest).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      "00000000-0000-4000-8000-000000000017",
      "00000000-0000-4000-8000-000000000005",
      expect.objectContaining({
        renewalPrice: 210000,
        newBillingCycle: "6months",
        costPrice: 120000,
        collectedAmount: 150000,
        notes: "Khách cọc trước 150k",
      }),
    );
    expect(body.data.finance_snapshot).toMatchObject({
      cycle_months: 6,
      renewal_price: 210000,
      cost_price: 120000,
      collected_amount: 150000,
    });
  }, PREMIUM_RENEWAL_ROUTE_TIMEOUT_MS);

  it("PUT /api/premium/subscriptions/[id]/renew rejects invalid billing cycles", async () => {
    const subscriptionBuilder = createSingleBuilder({
      data: {
        id: "00000000-0000-4000-8000-000000000017",
        customer_id: "00000000-0000-4000-8000-000000000005",
        premium_account_id: "00000000-0000-4000-8000-000000000016",
        status: "active",
        renewal_status: "none",
        expiry_date: "2026-07-01",
        billing_cycle: "3months",
        cycle_months: 3,
        final_price: 150000,
        original_price: 150000,
      },
      error: null,
    });
    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === "customer_premium_subscriptions") {
          return subscriptionBuilder;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const createRenewalRequest = vi.fn();
    const { PUT } = await loadRoute("@/app/api/premium/subscriptions/[id]/renew/route", {
      supabaseAdmin,
      subscriptionsHelpers: {
        createRenewalRequest,
      },
    });

    const response = await PUT(
      createTestRequest("http://localhost/api/premium/subscriptions/00000000-0000-4000-8000-000000000017/renew", {
        method: "PUT",
        body: {
          new_billing_cycle: "0months",
        },
      }),
      { params: { id: "00000000-0000-4000-8000-000000000017" } } as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("new_billing_cycle");
    expect(createRenewalRequest).not.toHaveBeenCalled();
  }, PREMIUM_RENEWAL_ROUTE_TIMEOUT_MS);

  it("POST /api/premium/renewals/[id]/confirm updates subscription with renewal finance snapshot", async () => {
    const renewalBuilder = createSingleBuilder({
      data: {
        id: "00000000-0000-4000-8000-000000000075",
        status: "pending",
        account_id: TEST_ACCOUNT_ID,
        original_subscription_id: "00000000-0000-4000-8000-000000000017",
      },
      error: null,
    });
    const confirmRenewalRequest = vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000075",
      status: "confirmed",
      renewal_price: 210000,
      collected_amount: 150000,
      cost_price: 120000,
      new_billing_cycle: "6months",
    });

    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table === "subscription_renewals") {
          return renewalBuilder;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const { POST } = await loadRoute("@/app/api/premium/renewals/[id]/confirm/route", {
      supabaseAdmin,
      subscriptionsHelpers: {
        confirmRenewalRequest,
        calculateExpiryDate: vi.fn().mockReturnValue("2027-01-01"),
        getCycleMonths: vi.fn().mockReturnValue(6),
      },
    });

    const response = await POST(
      createTestRequest("http://localhost/api/premium/renewals/00000000-0000-4000-8000-000000000075/confirm", {
        method: "POST",
        body: {
          renewal_price: 210000,
          new_billing_cycle: "6months",
          cost_price: 120000,
          collected_amount: 150000,
          notes: "Đã chốt kỳ 6 tháng",
        },
      }),
      { params: { id: "00000000-0000-4000-8000-000000000075" } } as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(confirmRenewalRequest).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000075",
      TEST_ACCOUNT_ID,
      expect.objectContaining({
        renewalPrice: 210000,
        newBillingCycle: "6months",
        costPrice: 120000,
        collectedAmount: 150000,
        notes: "Đã chốt kỳ 6 tháng",
      }),
    );
    expect(body.data).toMatchObject({
      id: "00000000-0000-4000-8000-000000000075",
      status: "confirmed",
    });
  }, PREMIUM_RENEWAL_ROUTE_TIMEOUT_MS);
});
