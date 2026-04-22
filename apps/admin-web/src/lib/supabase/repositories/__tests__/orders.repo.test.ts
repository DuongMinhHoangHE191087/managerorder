import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

function createSupabaseMock(builders: Record<string, ReturnType<typeof vi.fn> | object>) {
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
  vi.doMock("@/lib/supabase/admin", () => ({
    supabaseAdmin,
  }));
  return import("@/lib/supabase/repositories/orders.repo");
}

describe("orders.repo relation-cache fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates getOrderWithItems from base rows without nested joins", async () => {
    const ordersBuilder = createQueryBuilder(
      {
        data: {
          id: "ord-1",
          account_id: TEST_ACCOUNT_ID,
          customer_id: "cust-1",
          product_id: "prod-1",
          status: "active",
          total_amount_vnd: 200000,
          total_paid: 50000,
          deleted_at: null,
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
            assigned_source_account_id: "src-1",
            price_vnd: 200000,
            cost_price_vnd: 100000,
          },
        ],
        error: null,
      },
      "order",
    );

    const keysBuilder = createQueryBuilder(
      {
        data: [{ id: "key-1", key_code: "KEY-1", product_id: "prod-1" }],
        error: null,
      },
      "order",
    );

    const customerContactsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "ct-1",
            customer_id: "cust-1",
            channel: "email",
            value: "customer@example.com",
            is_verified: true,
            created_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
    );

    const customersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "cust-1",
            full_name: "Fallback Customer",
            type: "retail",
          },
        ],
        error: null,
      },
      "in",
    );

    const productsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "prod-1",
            name: "Netflix",
            mode: "shared",
          },
        ],
        error: null,
      },
      "in",
    );

    const sourceAccountsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "src-1",
            email: "source@example.com",
            provider: "gmail",
          },
        ],
        error: null,
      },
      "order",
    );

    const supabaseAdmin = createSupabaseMock({
      orders: ordersBuilder,
      order_items: orderItemsBuilder,
      license_keys: keysBuilder,
      customer_contacts: customerContactsBuilder,
      customers: customersBuilder,
      products: productsBuilder,
      source_accounts: sourceAccountsBuilder,
    });

    const { getOrderWithItems } = await loadRepo(supabaseAdmin);
    const order = await getOrderWithItems("ord-1", TEST_ACCOUNT_ID);

    expect(order).not.toBeNull();
    expect(order?.customer?.full_name).toBe("Fallback Customer");
    expect(order?.product?.name).toBe("Netflix");
    expect(order?.items[0].assigned_source_account?.email).toBe("source@example.com");
    expect(order?.items[0].license_keys).toHaveLength(1);
  });

  it("hydrates listOrders from base rows without relying on nested joins", async () => {
    const ordersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "ord-2",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "cust-2",
            product_id: "prod-2",
            order_code: "ORD-2",
            status: "active",
            total_amount_vnd: 300000,
            total_paid: 100000,
            product_name_snapshot: "Product Snapshot",
            created_at: "2026-04-10T00:00:00.000Z",
            expires_at: "2026-05-10T00:00:00.000Z",
            deleted_at: null,
          },
        ],
        error: null,
      },
      "order",
    );

    const customersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "cust-2",
            full_name: "List Customer",
            type: "retail",
          },
        ],
        error: null,
      },
      "in",
    );

    const productsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "prod-2",
            name: "List Product",
            mode: "shared",
          },
        ],
        error: null,
      },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      orders: ordersBuilder,
      customers: customersBuilder,
      products: productsBuilder,
    });

    const { listOrders } = await loadRepo(supabaseAdmin);
    const rows = await listOrders(TEST_ACCOUNT_ID);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(expect.objectContaining({
      customer: expect.objectContaining({
        full_name: "List Customer",
      }),
      product: expect.objectContaining({
        name: "List Product",
      }),
    }));
  });
});
