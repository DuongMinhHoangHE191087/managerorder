import { beforeEach, describe, expect, it, vi } from "vitest";

function createQueryChain(
  finalResult: { data?: unknown; error?: { message: string } | null } = {
    data: null,
    error: null,
  },
) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.then = (resolve: (value: { data?: unknown; error?: { message: string } | null }) => unknown) =>
    resolve(finalResult);
  return chain;
}

const mockFrom = vi.fn();
const mockCached = vi.fn(
  async (...args: [string, () => Promise<unknown>, number]) => args[1](),
);
const mockInvalidate = vi.fn((_key: string) => undefined);

vi.mock("@/lib/cache/db-cache", () => ({
  cached: (...args: [string, () => Promise<unknown>, number]) => mockCached(...args),
  invalidate: (...args: [string]) => mockInvalidate(...args),
  TTL: { LIST: 60_000 },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const { getProviderById, listProviders } = await import(
  "@/lib/supabase/repositories/providers.repo"
);

describe("providers.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists providers from the base table and merges purchase-order stats", async () => {
    const providersChain = createQueryChain({
      data: [
        {
          id: "pv-1",
          account_id: "acc-1",
          name: "Provider A",
          contacts: [],
          tier: "regular",
          reliability_score: 90,
          notes: "Ghi chú A",
          deleted_at: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "pv-2",
          account_id: "acc-1",
          name: "Provider B",
          contacts: [],
          tier: "vip",
          reliability_score: 95,
          notes: null,
          deleted_at: null,
          created_at: "2026-01-02T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
      ],
      error: null,
    });

    const purchaseOrdersChain = createQueryChain({
      data: [
        { provider_id: "pv-1", total_amount_vnd: 1000000 },
        { provider_id: "pv-1", total_amount_vnd: 500000 },
        { provider_id: "pv-2", total_amount_vnd: 250000 },
      ],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "providers") return providersChain;
      if (table === "purchase_orders") return purchaseOrdersChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await listProviders("acc-1");

    expect(mockFrom).toHaveBeenCalledWith("providers");
    expect(mockFrom).toHaveBeenCalledWith("purchase_orders");
    expect(mockFrom).not.toHaveBeenCalledWith("provider_stats_view");
    expect(purchaseOrdersChain.in).toHaveBeenCalledWith("provider_id", ["pv-1", "pv-2"]);
    expect(result).toEqual([
      expect.objectContaining({
        id: "pv-1",
        total_import_amount_vnd: 1500000,
        purchase_order_count: 2,
      }),
      expect.objectContaining({
        id: "pv-2",
        total_import_amount_vnd: 250000,
        purchase_order_count: 1,
      }),
    ]);
  });

  it("returns a single provider with zeroed stats when no purchase orders exist", async () => {
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
      data: [],
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "providers") return providerChain;
      if (table === "purchase_orders") return purchaseOrdersChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await getProviderById("pv-9", "acc-1");

    expect(result).toEqual(
      expect.objectContaining({
        id: "pv-9",
        total_import_amount_vnd: 0,
        purchase_order_count: 0,
      }),
    );
    expect(purchaseOrdersChain.in).toHaveBeenCalledWith("provider_id", ["pv-9"]);
  });
});
