import { describe, expect, it, vi } from "vitest";
import { createTestRequest, mockWithAccount, mockWithErrorHandler } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/cache/db-cache", () => ({
  cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  TTL: { AGGREGATE: 30_000 },
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { from: vi.fn() },
}));
vi.mock("@/lib/supabase/repositories/products.repo", () => ({
  listProducts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/supabase/repositories/source-accounts.repo", () => ({
  listSourceAccounts: vi.fn().mockResolvedValue([]),
}));

import { supabaseAdmin } from "@/lib/supabase/admin";

function createQueryChain(finalResult: { data?: unknown; error?: { code?: string; message: string } | null }) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(finalResult);
  chain.then = (resolve: (value: { data?: unknown; error?: { code?: string; message: string } | null }) => unknown) =>
    resolve(finalResult);
  return chain;
}

describe("dashboard fail-soft routes", () => {
  it("returns empty product-profit payload when orders relation is missing", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "orders") {
        return createQueryChain({
          data: null,
          error: {
            code: "42P01",
            message: 'relation "public.orders" does not exist',
          },
        }) as any;
      }

      if (table === "order_items") {
        return createQueryChain({ data: [], error: null }) as any;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { GET } = await import("@/app/api/dashboard/product-profit/route");
    const response = await GET(
      createTestRequest("http://localhost/api/dashboard/product-profit?days=30"),
      { params: {} } as any,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.data).toEqual([]);
    expect(body.data.summary).toEqual({
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      avgRoi: null,
    });
  });

  it("returns empty import-summary payload when purchase_orders relation is missing", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "purchase_orders") {
        return createQueryChain({
          data: null,
          error: {
            code: "42P01",
            message: 'relation "public.purchase_orders" does not exist',
          },
        }) as any;
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { GET } = await import("@/app/api/dashboard/import-summary/route");
    const response = await GET(
      createTestRequest("http://localhost/api/dashboard/import-summary?months=6"),
      { params: {} } as any,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.data).toEqual([]);
    expect(body.data.summary).toEqual({
      totalOrders: 0,
      totalAmountVnd: 0,
      avgPerOrder: 0,
    });
  });
});
