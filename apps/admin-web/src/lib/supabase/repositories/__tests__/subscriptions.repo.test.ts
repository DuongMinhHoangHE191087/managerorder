import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNT_ID } from "@/app/api/__tests__/helpers/setup";

const SUBSCRIPTIONS_REPO_TIMEOUT_MS = 20_000;

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
  count?: number | null;
};

type QueryBuilder = Record<string, any>;

function createQueryBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "single" | "order" | "in" | "range" = "single",
): QueryBuilder {
  const chain: QueryBuilder = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
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

function createMutationBuilder<TSelect, TInsert>(
  selectResult: SupabaseResult<TSelect>,
  insertResult: SupabaseResult<TInsert>,
): QueryBuilder {
  const chain: QueryBuilder = {};
  const single = vi
    .fn()
    .mockResolvedValueOnce(selectResult)
    .mockResolvedValueOnce(insertResult);

  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);
  chain.single = single;
  chain.maybeSingle = vi.fn(() => Promise.resolve(selectResult));

  return chain;
}

function createSupabaseMock(builders: Record<string, QueryBuilder>) {
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
            id: "00000000-0000-4000-8000-000000000017",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "00000000-0000-4000-8000-000000000005",
            premium_account_id: "00000000-0000-4000-8000-0000000003f0",
            package_id: "00000000-0000-4000-8000-000000000086",
            service_type_id: "00000000-0000-4000-8000-000000000085",
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
            id: "00000000-0000-4000-8000-0000000003f0",
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
            id: "00000000-0000-4000-8000-000000000086",
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
            id: "00000000-0000-4000-8000-000000000085",
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
      premium_account_id: "00000000-0000-4000-8000-0000000003f0",
      premium_accounts: expect.objectContaining({ primary_email: "account@example.com" }),
      premium_packages: expect.objectContaining({ name: "Gold" }),
      premium_service_types: expect.objectContaining({ slug: "youtube" }),
    }));
  }, SUBSCRIPTIONS_REPO_TIMEOUT_MS);

  it("hydrates renewal details from the original subscription row", async () => {
    const renewalBuilder = createQueryBuilder(
      {
        data: {
          id: "00000000-0000-4000-8000-000000000018",
          account_id: TEST_ACCOUNT_ID,
          original_subscription_id: "00000000-0000-4000-8000-000000000017",
          customer_id: "00000000-0000-4000-8000-000000000005",
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
            id: "00000000-0000-4000-8000-000000000017",
            customer_id: "00000000-0000-4000-8000-000000000005",
            premium_account_id: "00000000-0000-4000-8000-0000000003f0",
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
    const result = await getRenewalRequest("00000000-0000-4000-8000-000000000018", TEST_ACCOUNT_ID);

    expect(result).toEqual(expect.objectContaining({
      original_subscription_id: "00000000-0000-4000-8000-000000000017",
      customer_premium_subscriptions: expect.objectContaining({
        premium_account_id: "00000000-0000-4000-8000-0000000003f0",
        billing_cycle: "monthly",
      }),
    }));
  }, SUBSCRIPTIONS_REPO_TIMEOUT_MS);

  it("defaults renewal finance from subscription and package data when values are omitted", async () => {
    const selectExistingBuilder = createMutationBuilder(
      { data: null, error: null },
      {
        data: {
          id: "00000000-0000-4000-8000-000000000075",
          account_id: TEST_ACCOUNT_ID,
          original_subscription_id: "00000000-0000-4000-8000-000000000017",
          customer_id: "00000000-0000-4000-8000-000000000005",
          status: "pending",
          renewal_price: 210000,
          total_price: 210000,
          new_billing_cycle: "6months",
          new_cycle_months: 6,
          cost_price: 180000,
          collected_amount: 210000,
          profit_amount: 30000,
          refund_calculated: false,
          refund_amount: null,
        },
        error: null,
      },
    );

    const subscriptionBuilder = createQueryBuilder(
      {
        data: {
          id: "00000000-0000-4000-8000-000000000017",
          customer_id: "00000000-0000-4000-8000-000000000005",
          premium_account_id: "00000000-0000-4000-8000-0000000003f0",
          package_id: "00000000-0000-4000-8000-000000000086",
          service_type_id: "00000000-0000-4000-8000-000000000085",
          premium_packages: {
            default_price: 90000,
            renewal_price_factor: 1.2,
          },
          start_date: "2026-04-01",
          expiry_date: "2026-07-01",
          original_price: 150000,
          final_price: 150000,
          billing_cycle: "3months",
          cycle_months: 3,
          status: "active",
          deleted_at: null,
        },
        error: null,
      },
      "single",
    );

    const premiumAccountsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "00000000-0000-4000-8000-0000000003f0",
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
            id: "00000000-0000-4000-8000-000000000086",
            name: "Gold",
            slug: "gold",
            total_slots: 5,
            default_price: 90000,
            renewal_price_factor: 1.2,
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
            id: "00000000-0000-4000-8000-000000000085",
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
      subscription_renewals: selectExistingBuilder,
      customer_premium_subscriptions: subscriptionBuilder,
      premium_accounts: premiumAccountsBuilder,
      premium_packages: packagesBuilder,
      premium_service_types: serviceTypesBuilder,
    });

    const { createRenewalRequest } = await loadRepo(supabaseAdmin);
    const result = await createRenewalRequest(
      TEST_ACCOUNT_ID,
      "00000000-0000-4000-8000-000000000017",
      "00000000-0000-4000-8000-000000000005",
      {
        renewalPrice: 210000,
        newBillingCycle: "6months",
      },
    );

    const insertRows = selectExistingBuilder.insert.mock.calls[0]?.[0] as Array<Record<string, unknown>> | undefined;

    expect(result).toEqual(expect.objectContaining({
      status: "pending",
      renewal_price: 210000,
      cost_price: 180000,
      collected_amount: 210000,
      new_billing_cycle: "6months",
      new_cycle_months: 6,
    }));
    expect(insertRows?.[0]).toMatchObject({
      renewal_price: 210000,
      total_price: 210000,
      cost_price: 180000,
      collected_amount: 210000,
      profit_amount: 30000,
      new_billing_cycle: "6months",
      new_cycle_months: 6,
    });
  }, SUBSCRIPTIONS_REPO_TIMEOUT_MS);
});
