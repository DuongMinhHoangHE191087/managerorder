import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest } from "./helpers/setup";

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
};

function createQueryBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "order" | "limit" | "in" | "single" = "single",
) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    in: vi.fn(() => (terminal === "in" ? Promise.resolve(result) : chain)),
    order: vi.fn(() => (terminal === "order" ? Promise.resolve(result) : chain)),
    limit: vi.fn(() => (terminal === "limit" ? Promise.resolve(result) : chain)),
    single: vi.fn(() => Promise.resolve(result)),
  };

  return chain;
}

function createSequentialBuilder<T>(
  results: SupabaseResult<T>[],
  terminals: Array<"order" | "limit" | "in" | "single">,
) {
  let selectCount = 0;
  return {
    select: vi.fn(() => {
      const result = results[Math.min(selectCount, results.length - 1)];
      const terminal = terminals[Math.min(selectCount, terminals.length - 1)];
      selectCount += 1;
      return createQueryBuilder(result, terminal);
    }),
  };
}

function createSupabaseMock(builders: Record<string, ReturnType<typeof vi.fn> | object>) {
  return {
    from: vi.fn((table: string) => {
      const builder = builders[table];
      if (!builder) {
        throw new Error(`Missing builder for ${table}`);
      }
      return builder;
    }),
  };
}

async function loadRoute(supabaseAdmin: { from: ReturnType<typeof vi.fn> }) {
  vi.resetModules();
  vi.doMock("@/lib/api/with-account", () => mockWithAccount());
  vi.doMock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
  vi.doMock("@/lib/supabase/admin", () => ({ supabaseAdmin }));
  vi.doMock("@/lib/cache/db-cache", () => ({
    cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    TTL: { AGGREGATE: 1, LIST: 1, ITEM: 1 },
  }));
  vi.doMock("@/lib/supabase/repositories/products.repo", () => ({
    listProducts: vi.fn().mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000039", name: "Netflix" }]),
  }));
  vi.doMock("@/lib/supabase/repositories/source-accounts.repo", () => ({
    listSourceAccounts: vi.fn().mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-00000000003a",
        email: "source@example.com",
        max_slots: 1,
        used_slots: 1,
        product_ids: ["00000000-0000-4000-8000-000000000039"],
        expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      },
    ]),
  }));

  return import("@/app/api/dashboard/stats/route");
}

describe("GET /api/dashboard/stats relation-cache fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to base customer rows when the joined customer relation is stale", async () => {
    const ordersBuilder = createSequentialBuilder(
      [
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000000f",
              customer_id: "00000000-0000-4000-8000-000000000005",
              product_id: "00000000-0000-4000-8000-000000000039",
              total_amount_vnd: 100000,
              total_cost_vnd: 50000,
              total_paid: 25000,
              payment_method: "bank_transfer",
              payment_terms: "paid",
              status: "paid",
              created_at: "2026-04-10T00:00:00.000Z",
            },
          ],
          error: null,
        },
        {
          data: null,
          error: { code: "PGRST200", message: "order relation cache miss" },
        },
        {
          data: [
            {
              id: "00000000-0000-4000-8000-00000000000f",
              customer_id: "00000000-0000-4000-8000-000000000005",
              product_id: "00000000-0000-4000-8000-000000000039",
              total_amount_vnd: 100000,
              total_cost_vnd: 50000,
              total_paid: 25000,
              payment_method: "bank_transfer",
              payment_terms: "paid",
              status: "paid",
              created_at: "2026-04-10T00:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
      ["order", "limit", "limit"],
    );

    const customersBuilder = createSequentialBuilder(
      [
        {
          data: [
            {
              id: "cust-overdue",
              full_name: "Overdue Customer",
              debt_amount_vnd: 200000,
              debt_overdue_days: 7,
            },
          ],
          error: null,
        },
        {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000005",
              full_name: "Fallback Customer",
            },
          ],
          error: null,
        },
      ],
      ["limit", "in"],
    );

    const settingsBuilder = createQueryBuilder(
      {
        data: [
          {
            locale: "vi-VN",
            time_zone: "Asia/Ho_Chi_Minh",
            currency: "VND",
          },
        ],
        error: null,
      },
      "limit",
    );

    const refundBuilder = createQueryBuilder(
      {
        data: [{ refundable_amount_vnd: 50000 }],
        error: null,
      },
      "order",
    );

    const supabaseAdmin = createSupabaseMock({
      orders: ordersBuilder,
      customers: customersBuilder,
      system_settings: settingsBuilder,
      refund_requests: refundBuilder,
    });

    const { GET } = await loadRoute(supabaseAdmin);
    const response = await GET(
      createTestRequest("http://localhost/api/dashboard/stats?days=30"),
      { params: {} } as any,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.recentOrders[0].customerName).toBe("Fallback Customer");
  });
});
