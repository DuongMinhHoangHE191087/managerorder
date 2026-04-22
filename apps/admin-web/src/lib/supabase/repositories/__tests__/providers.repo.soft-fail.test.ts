import { beforeEach, describe, expect, it, vi } from "vitest";

function createQueryChain(
  finalResult: { data?: unknown; error?: { code?: string; message: string } | null } = {
    data: null,
    error: null,
  },
) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.then = (resolve: (value: { data?: unknown; error?: { code?: string; message: string } | null }) => unknown) =>
    resolve(finalResult);
  return chain;
}

const mockFrom = vi.fn();
const mockCached = vi.fn(
  async (...args: [string, () => Promise<unknown>, number]) => args[1](),
);

vi.mock("@/lib/cache/db-cache", () => ({
  cached: (...args: [string, () => Promise<unknown>, number]) => mockCached(...args),
  invalidate: vi.fn(),
  TTL: { LIST: 60_000 },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const { getProviderById, listProviders } = await import("../providers.repo");

describe("providers.repo soft-fail behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to zero stats when purchase_orders relation is missing", async () => {
    const providersChain = createQueryChain({
      data: [
        {
          id: "pv-1",
          account_id: "acc-1",
          name: "Provider A",
          contacts: [],
          tier: "regular",
          reliability_score: 90,
          notes: null,
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    const purchaseOrdersChain = createQueryChain({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.purchase_orders" does not exist',
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "providers") return providersChain;
      if (table === "purchase_orders") return purchaseOrdersChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(listProviders("acc-1")).resolves.toEqual([
      expect.objectContaining({
        id: "pv-1",
        total_import_amount_vnd: 0,
        purchase_order_count: 0,
      }),
    ]);
  });

  it("keeps provider detail stable when stats relation is missing", async () => {
    const providerChain = createQueryChain({
      data: {
        id: "pv-9",
        account_id: "acc-1",
        name: "Provider Z",
        contacts: [],
        tier: "regular",
        reliability_score: 100,
        notes: null,
        deleted_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });

    const purchaseOrdersChain = createQueryChain({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.purchase_orders" does not exist',
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "providers") return providerChain;
      if (table === "purchase_orders") return purchaseOrdersChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(getProviderById("pv-9", "acc-1")).resolves.toEqual(
      expect.objectContaining({
        id: "pv-9",
        total_import_amount_vnd: 0,
        purchase_order_count: 0,
      }),
    );
  });
});
