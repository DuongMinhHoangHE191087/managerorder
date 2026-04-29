import { beforeEach, describe, expect, it, vi } from "vitest";

function createQueryChain(
  finalResult: { data?: unknown; error?: { code?: string; message: string } | null; count?: number | null } = {
    data: null,
    error: null,
  },
) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.then = (resolve: (value: { data?: unknown; error?: { code?: string; message: string } | null }) => unknown) =>
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
  TTL: { REFERENCE: 60_000 },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const {
  deletePaymentSource,
  createSalesChannel,
  getSalesChannelById,
  listSalesChannels,
} = await import("../settings.repo");

describe("settings.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list when sales_channels is missing", async () => {
    const chain = createQueryChain({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.sales_channels" does not exist',
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "sales_channels") return chain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(listSalesChannels("00000000-0000-4000-8000-000000000016")).resolves.toEqual([]);
  });

  it("returns null when a sales channel lookup hits a missing table", async () => {
    const chain = createQueryChain({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.sales_channels" does not exist',
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "sales_channels") return chain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(getSalesChannelById("00000000-0000-4000-8000-000000000129", "00000000-0000-4000-8000-000000000016")).resolves.toBeNull();
  });

  it("throws a schema initialization error for sales channel writes when the table is missing", async () => {
    const chain = createQueryChain({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.sales_channels" does not exist',
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "sales_channels") return chain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      createSalesChannel("00000000-0000-4000-8000-000000000016", {
        name: "Kênh CTV",
        defaultDeliveryMode: "landing_page",
        defaultLandingTemplateKey: "ctv_neutral",
      }),
    ).rejects.toMatchObject({
      code: "SCHEMA_NOT_INITIALIZED",
      statusCode: 503,
    });
  });

  it("blocks payment source deletion when the source is still used by orders", async () => {
    const ordersChain = createQueryChain({
      data: null,
      error: null,
      count: 2,
    });
    const paymentSourceChain = createQueryChain({
      data: null,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return ordersChain;
      if (table === "payment_sources") return paymentSourceChain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(deletePaymentSource("00000000-0000-4000-8000-00000000012a", "00000000-0000-4000-8000-000000000016")).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
    });
    expect(paymentSourceChain.delete).not.toHaveBeenCalled();
  });
});
