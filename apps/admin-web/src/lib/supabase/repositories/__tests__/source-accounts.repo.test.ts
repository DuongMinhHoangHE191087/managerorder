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
    update: vi.fn(() => chain),
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
          id: "00000000-0000-4000-8000-00000000003a",
          account_id: TEST_ACCOUNT_ID,
          email: "source@example.com",
          provider: "gmail",
          max_slots: 10,
          used_slots: 3,
          product_ids: ["00000000-0000-4000-8000-000000000039"],
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
            id: "00000000-0000-4000-8000-000000000058",
            order_id: "00000000-0000-4000-8000-00000000000f",
            product_id: "00000000-0000-4000-8000-000000000039",
            product_name_snapshot: "Netflix",
            quantity: 2,
            price_vnd: 100000,
            cost_price_vnd: 50000,
            subtotal_vnd: 200000,
            notes: null,
            assigned_source_account_id: "00000000-0000-4000-8000-00000000003a",
            customer_nick_used: "nick-a",
            created_at: "2026-04-10T00:00:00.000Z",
          },
          {
            id: "00000000-0000-4000-8000-000000000130",
            order_id: "00000000-0000-4000-8000-00000000011f",
            product_id: "00000000-0000-4000-8000-000000000039",
            product_name_snapshot: "Netflix",
            quantity: 1,
            price_vnd: 100000,
            cost_price_vnd: 50000,
            subtotal_vnd: 100000,
            notes: null,
            assigned_source_account_id: "00000000-0000-4000-8000-00000000003a",
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
            id: "00000000-0000-4000-8000-00000000000f",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "00000000-0000-4000-8000-000000000005",
            created_at: "2026-04-09T00:00:00.000Z",
            status: "active",
          },
          {
            id: "00000000-0000-4000-8000-00000000011f",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "00000000-0000-4000-8000-000000000006",
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
          { id: "00000000-0000-4000-8000-000000000005", full_name: "Customer One", type: "retail" },
          { id: "00000000-0000-4000-8000-000000000006", full_name: "Customer Two", type: "retail" },
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
    const breakdown = await getSlotBreakdown("00000000-0000-4000-8000-00000000003a", TEST_ACCOUNT_ID);

    expect(breakdown.connectedCount).toBe(3);
    expect(breakdown.reservedCount).toBe(1);
    expect(breakdown.connectedItems).toEqual([
      expect.objectContaining({
        orderId: "00000000-0000-4000-8000-00000000000f",
        customerName: "Customer One",
      }),
      expect.objectContaining({
        orderId: "00000000-0000-4000-8000-00000000011f",
        customerName: "Customer Two",
      }),
    ]);
  });

  it("rejects disconnecting an order item that does not belong to the account", async () => {
    const sourceAccountBuilder = createQueryBuilder(
      {
        data: {
          id: "00000000-0000-4000-8000-00000000003a",
          account_id: TEST_ACCOUNT_ID,
          email: "source@example.com",
          provider: "gmail",
          max_slots: 10,
          used_slots: 3,
          product_ids: ["00000000-0000-4000-8000-000000000039"],
          notes: null,
          reserved_nicks: [],
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
        data: {
          id: "00000000-0000-4000-8000-000000000058",
          order_id: "00000000-0000-4000-8000-00000000000f",
          assigned_source_account_id: "00000000-0000-4000-8000-00000000003a",
          quantity: 1,
        },
        error: null,
      },
      "single",
    );

    const ordersBuilder = createQueryBuilder(
      { data: [], error: null },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      source_accounts: sourceAccountBuilder,
      order_items: orderItemsBuilder,
      orders: ordersBuilder,
    });

    const { disconnectSourceAccount } = await loadRepo(supabaseAdmin);

    await expect(disconnectSourceAccount("00000000-0000-4000-8000-00000000003a", "00000000-0000-4000-8000-000000000058", TEST_ACCOUNT_ID)).rejects.toThrow(
      "Order item does not belong to this account",
    );
  });

  it("rejects reconnecting an order item already assigned to another source account", async () => {
    const sourceAccountBuilder = createQueryBuilder(
      {
        data: {
          id: "00000000-0000-4000-8000-00000000003a",
          account_id: TEST_ACCOUNT_ID,
          email: "source@example.com",
          provider: "gmail",
          max_slots: 10,
          used_slots: 3,
          product_ids: ["00000000-0000-4000-8000-000000000039"],
          notes: null,
          reserved_nicks: [],
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
        data: {
          id: "00000000-0000-4000-8000-000000000058",
          order_id: "00000000-0000-4000-8000-00000000000f",
          assigned_source_account_id: "00000000-0000-4000-8000-000000000131",
          quantity: 1,
        },
        error: null,
      },
      "single",
    );

    const ordersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "00000000-0000-4000-8000-00000000000f",
            account_id: TEST_ACCOUNT_ID,
          },
        ],
        error: null,
      },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      source_accounts: sourceAccountBuilder,
      order_items: orderItemsBuilder,
      orders: ordersBuilder,
    });

    const { reconnectSourceAccount } = await loadRepo(supabaseAdmin);

    await expect(reconnectSourceAccount("00000000-0000-4000-8000-00000000003a", "00000000-0000-4000-8000-000000000058", TEST_ACCOUNT_ID)).rejects.toThrow(
      "Order item is already connected to a source account",
    );
  });
});
