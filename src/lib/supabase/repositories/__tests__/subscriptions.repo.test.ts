import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNT_ID } from "@/app/api/__tests__/helpers/setup";

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
  count?: number | null;
};

function createQueryBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "single" | "order" | "in" | "range" = "single",
) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => (terminal === "in" ? Promise.resolve(result) : chain)),
    order: vi.fn(() => (terminal === "order" ? Promise.resolve(result) : chain)),
    range: vi.fn(() => (terminal === "range" ? Promise.resolve(result) : chain)),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };

  return chain;
}

function createSupabaseMock(builders: Record<string, ReturnType<typeof createQueryBuilder>>) {
  return {
    from: vi.fn((table: string) => {
      const builder = builders[table];
      if (!builder) {
        throw new Error(`Missing supabase builder for table ${table}`);
      }
      return builder;
    }),
  };
}

async function loadRepo(supabaseAdmin: { from: ReturnType<typeof vi.fn> }) {
  vi.resetModules();
  vi.doMock("@/lib/supabase/admin", () => ({ supabaseAdmin }));
  vi.doMock("@/lib/cache/db-cache", () => ({
    cached: (_key: string, fn: () => Promise<unknown>) => fn(),
    invalidate: vi.fn(),
    TTL: { LIST: 0, ITEM: 0 },
  }));
  return import("@/lib/supabase/repositories/subscriptions.repo");
}

describe("subscriptions.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates active subscriptions from base rows", async () => {
    const subscriptionsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "sub-1",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cust-1",
            premium_account_id: "pa-1",
            package_id: "pkg-1",
            service_type_id: "svc-1",
            start_date: "2026-04-01",
            expiry_date: "2026-05-01",
            original_price: 100000,
            discount: 0,
            final_price: 100000,
            renewal_status: "active",
            status: "active",
            notes: null,
            refund_amount: null,
            renewal_asked_at: null,
            renewal_confirmed_at: null,
            renewal_denied_at: null,
            renewal_denied_reason: null,
            created_at: "2026-04-01T00:00:00.000Z",
            updated_at: "2026-04-01T00:00:00.000Z",
            deleted_at: null,
          },
        ],
        error: null,
        count: 1,
      },
      "range",
    );

    const premiumAccountsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "pa-1",
            primary_email: "account@example.com",
            total_slots: 5,
            used_slots: 2,
            status: "active",
          },
        ],
        error: null,
      },
      "in",
    );

    const packagesBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "pkg-1",
            name: "Gold",
            slug: "gold",
            total_slots: 5,
            default_price: 100000,
          },
        ],
        error: null,
      },
      "in",
    );

    const serviceTypesBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "svc-1",
            name: "YouTube",
            slug: "youtube",
            category: "streaming",
            supports_connection_check: true,
          },
        ],
        error: null,
      },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      customer_premium_subscriptions: subscriptionsBuilder,
      premium_accounts: premiumAccountsBuilder,
      premium_packages: packagesBuilder,
      premium_service_types: serviceTypesBuilder,
    });

    const { getActiveSubscriptions } = await loadRepo(supabaseAdmin);
    const result = await getActiveSubscriptions(TEST_ACCOUNT_ID, 20, 0);

    expect(result.total).toBe(1);
    expect(result.data?.[0]).toEqual(expect.objectContaining({
      premium_account_id: "pa-1",
      premium_accounts: expect.objectContaining({ primary_email: "account@example.com" }),
      premium_packages: expect.objectContaining({ name: "Gold" }),
      premium_service_types: expect.objectContaining({ slug: "youtube" }),
    }));
  });

  it("hydrates renewal details from the original subscription row", async () => {
    const renewalBuilder = createQueryBuilder(
      {
        data: {
          id: "renew-1",
          account_id: TEST_ACCOUNT_ID,
          original_subscription_id: "sub-1",
          customer_id: "cust-1",
          status: "pending",
          original_price: 100000,
          refund_calculated: false,
          refund_amount: null,
        },
        error: null,
      },
      "single",
    );

    const originalSubscriptionBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "sub-1",
            customer_id: "cust-1",
            premium_account_id: "pa-1",
            start_date: "2026-04-01",
            expiry_date: "2026-05-01",
            original_price: 100000,
            final_price: 100000,
            billing_cycle: "monthly",
          },
        ],
        error: null,
      },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      subscription_renewals: renewalBuilder,
      customer_premium_subscriptions: originalSubscriptionBuilder,
    });

    const { getRenewalRequest } = await loadRepo(supabaseAdmin);
    const result = await getRenewalRequest("renew-1", TEST_ACCOUNT_ID);

    expect(result).toEqual(expect.objectContaining({
      original_subscription_id: "sub-1",
      customer_premium_subscriptions: expect.objectContaining({
        premium_account_id: "pa-1",
        billing_cycle: "monthly",
      }),
    }));
  });
});
