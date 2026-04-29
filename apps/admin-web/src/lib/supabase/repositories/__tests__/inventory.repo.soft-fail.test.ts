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
  chain.order = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.then = (resolve: (value: { data?: unknown; error?: { code?: string; message: string } | null }) => unknown) =>
    resolve(finalResult);
  return chain;
}

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const {
  createLicenseKey,
  listLicenseKeys,
} = await import("../inventory.repo");

describe("inventory.repo soft-fail behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty list when license_keys relation is missing", async () => {
    const chain = createQueryChain({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.license_keys" does not exist',
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "license_keys") return chain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(listLicenseKeys("00000000-0000-4000-8000-000000000016")).resolves.toEqual([]);
  });

  it("throws a schema initialization error when writes hit a missing license_keys table", async () => {
    const chain = createQueryChain({
      data: null,
      error: {
        code: "42P01",
        message: 'relation "public.license_keys" does not exist',
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "license_keys") return chain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      createLicenseKey("00000000-0000-4000-8000-000000000016", {
        key_code: "KEY-001",
        product_id: "00000000-0000-4000-8000-000000000039",
      }),
    ).rejects.toMatchObject({
      code: "SCHEMA_NOT_INITIALIZED",
      statusCode: 503,
    });
  });
});
