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
          id: "00000000-0000-4000-8000-00000000000f",
          account_id: TEST_ACCOUNT_ID,
          customer_id: "00000000-0000-4000-8000-000000000005",
          product_id: "00000000-0000-4000-8000-000000000039",
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
            id: "00000000-0000-4000-8000-000000000058",
            order_id: "00000000-0000-4000-8000-00000000000f",
            product_id: "00000000-0000-4000-8000-000000000039",
            assigned_source_account_id: "00000000-0000-4000-8000-00000000003a",
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
        data: [{ id: "00000000-0000-4000-8000-0000000000e5", key_code: "KEY-1", product_id: "00000000-0000-4000-8000-000000000039" }],
        error: null,
      },
      "order",
    );

    const customerContactsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "00000000-0000-4000-8000-0000000003e8",
            customer_id: "00000000-0000-4000-8000-000000000005",
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
            id: "00000000-0000-4000-8000-000000000005",
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
            id: "00000000-0000-4000-8000-000000000039",
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
            id: "00000000-0000-4000-8000-00000000003a",
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
    const order = await getOrderWithItems("00000000-0000-4000-8000-00000000000f", TEST_ACCOUNT_ID);

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
            id: "00000000-0000-4000-8000-00000000011f",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "00000000-0000-4000-8000-000000000006",
            product_id: "00000000-0000-4000-8000-000000000120",
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
            id: "00000000-0000-4000-8000-000000000006",
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
            id: "00000000-0000-4000-8000-000000000120",
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

  it("filters paginated orders with accent-insensitive backend search", async () => {
    const ordersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "00000000-0000-4000-8000-00000000000f",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "00000000-0000-4000-8000-000000000005",
            product_id: "00000000-0000-4000-8000-000000000039",
            order_code: "ORD-1",
            status: "active",
            total_amount_vnd: 300000,
            total_paid: 300000,
            product_name_snapshot: "Duolingo Family",
            created_at: "2026-04-10T00:00:00.000Z",
            deleted_at: null,
          },
          {
            id: "00000000-0000-4000-8000-00000000011f",
            account_id: TEST_ACCOUNT_ID,
            customer_id: "00000000-0000-4000-8000-000000000006",
            product_id: "00000000-0000-4000-8000-000000000120",
            order_code: "ORD-2",
            status: "active",
            total_amount_vnd: 200000,
            total_paid: 0,
            product_name_snapshot: "Netflix",
            created_at: "2026-04-09T00:00:00.000Z",
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
            id: "00000000-0000-4000-8000-000000000005",
            full_name: "\u0110\u1eb7ng V\u0103n L\u00e2m",
            type: "retail",
          },
          {
            id: "00000000-0000-4000-8000-000000000006",
            full_name: "Netflix Customer",
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
          { id: "00000000-0000-4000-8000-000000000039", name: "Duolingo", mode: "shared" },
          { id: "00000000-0000-4000-8000-000000000120", name: "Netflix", mode: "shared" },
        ],
        error: null,
      },
      "in",
    );

    const customerContactsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "00000000-0000-4000-8000-0000000003e8",
            customer_id: "00000000-0000-4000-8000-000000000005",
            channel: "zalo",
            value: "0394497949",
            is_verified: true,
            created_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
    );

    const supabaseAdmin = createSupabaseMock({
      orders: ordersBuilder,
      customers: customersBuilder,
      products: productsBuilder,
      customer_contacts: customerContactsBuilder,
    });

    const { getOrdersPaginated } = await loadRepo(supabaseAdmin);
    const result = await getOrdersPaginated(TEST_ACCOUNT_ID, {
      search: "dang van duolingo",
      page: 1,
      limit: 10,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("00000000-0000-4000-8000-00000000000f");
    expect(result.count).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});
