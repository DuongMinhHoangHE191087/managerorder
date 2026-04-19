import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNT_ID } from "@/app/api/__tests__/helpers/setup";

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
};

function createQueryBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "order" | "in" | "single" = "single",
) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
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
    TTL: { LIST: 0, ITEM: 0 },
  }));
  return import("@/lib/supabase/repositories/provider-product-prices.repo");
}

describe("provider-product-prices.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates provider names from base rows", async () => {
    const pricesBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "pp-1",
            account_id: TEST_ACCOUNT_ID,
            provider_id: "prov-1",
            product_id: "prod-1",
            cost_vnd: 12345,
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
    );

    const providersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "prov-1",
            name: "Provider One",
          },
        ],
        error: null,
      },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      provider_product_prices: pricesBuilder,
      providers: providersBuilder,
    });

    const { getProviderPricesForProduct } = await loadRepo(supabaseAdmin);
    const rows = await getProviderPricesForProduct(TEST_ACCOUNT_ID, "prod-1");

    expect(rows).toEqual([
      expect.objectContaining({
        provider_id: "prov-1",
        provider_name: "Provider One",
      }),
    ]);
  });
});
