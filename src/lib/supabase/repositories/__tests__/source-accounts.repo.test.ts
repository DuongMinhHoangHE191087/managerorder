import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNT_ID } from "@/app/api/__tests__/helpers/setup";

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
};

function createQueryBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "single" | "order" | "in" = "single",
) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => (terminal === "in" ? Promise.resolve(result) : chain)),
    order: vi.fn(() => (terminal === "order" ? Promise.resolve(result) : chain)),
    single: vi.fn(() => Promise.resolve(result)),
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
    invalidatePrefix: vi.fn(),
    TTL: { LIST: 0, ITEM: 0 },
  }));
  return import("@/lib/supabase/repositories/source-accounts.repo");
}

describe("source-accounts.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates slot breakdown from base order rows", async () => {
    const sourceAccountBuilder = createQueryBuilder(
      {
        data: {
          id: "src-1",
          account_id: TEST_ACCOUNT_ID,
          email: "source@example.com",
          provider: "gmail",
          max_slots: 10,
          used_slots: 3,
          product_ids: ["prod-1"],
          notes: null,
          reserved_nicks: ["nick-a"],
          status: "active",
          expires_at: "2026-06-01",
          purchase_cost_vnd: null,
          purchase_date: null,
          purchase_source: null,
          deleted_at: null,
          created_at: "2026-04-10T00:00:00.000Z",
          updated_at: "2026-04-10T00:00:00.000Z",
        },
        error: null,
      },
      "single",
    );

    const orderItemsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "item-1",
            order_id: "ord-1",
            product_id: "prod-1",
            product_name_snapshot: "Netflix",
            quantity: 2,
            price_vnd: 100000,
            cost_price_vnd: 50000,
            subtotal_vnd: 200000,
            notes: null,
            assigned_source_account_id: "src-1",
            customer_nick_used: "nick-a",
            created_at: "2026-04-10T00:00:00.000Z",
          },
          {
            id: "item-2",
            order_id: "ord-2",
            product_id: "prod-1",
            product_name_snapshot: "Netflix",
            quantity: 1,
            price_vnd: 100000,
            cost_price_vnd: 50000,
            subtotal_vnd: 100000,
            notes: null,
            assigned_source_account_id: "src-1",
            customer_nick_used: null,
            created_at: "2026-04-10T00:00:01.000Z",
          },
        ],
        error: null,
      },
      "order",
    );

    const ordersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "ord-1",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cust-1",
            created_at: "2026-04-09T00:00:00.000Z",
            status: "active",
          },
          {
            id: "ord-2",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cust-2",
            created_at: "2026-04-09T01:00:00.000Z",
            status: "active",
          },
        ],
        error: null,
      },
      "in",
    );

    const customersBuilder = createQueryBuilder(
      {
        data: [
          { id: "cust-1", full_name: "Customer One", type: "retail" },
          { id: "cust-2", full_name: "Customer Two", type: "retail" },
        ],
        error: null,
      },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      source_accounts: sourceAccountBuilder,
      order_items: orderItemsBuilder,
      orders: ordersBuilder,
      customers: customersBuilder,
    });

    const { getSlotBreakdown } = await loadRepo(supabaseAdmin);
    const breakdown = await getSlotBreakdown("src-1", TEST_ACCOUNT_ID);

    expect(breakdown.connectedCount).toBe(3);
    expect(breakdown.reservedCount).toBe(1);
    expect(breakdown.connectedItems).toEqual([
      expect.objectContaining({
        orderId: "ord-1",
        customerName: "Customer One",
      }),
      expect.objectContaining({
        orderId: "ord-2",
        customerName: "Customer Two",
      }),
    ]);
  });
});
