import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaNotInitializedError } from "@/lib/utils/errors";

function createQueryChain(results: Array<{ data?: unknown; error?: { code?: string; message: string } | null; throw?: unknown }>) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();
  for (const result of results) {
    if ("throw" in result) {
      chain.single.mockRejectedValueOnce(result.throw);
      continue;
    }
    chain.single.mockResolvedValueOnce(result);
  }
  chain.then = (resolve: (value: { data?: unknown; error?: { code?: string; message: string } | null }) => unknown) =>
    resolve(results[results.length - 1] ?? { data: null, error: null });
  return chain;
}

const mockFrom = vi.fn();
const mockCached = vi.fn(
  async (...args: [string, () => Promise<unknown>, number]) => args[1](),
);
const mockInvalidate = vi.fn((_key: string) => undefined);
const mockInvalidatePrefix = vi.fn((_prefix: string) => undefined);

vi.mock("@/lib/cache/db-cache", () => ({
  cached: (...args: [string, () => Promise<unknown>, number]) => mockCached(...args),
  invalidate: (...args: [string]) => mockInvalidate(...args),
  invalidatePrefix: (...args: [string]) => mockInvalidatePrefix(...args),
  TTL: { LIST: 60_000, ITEM: 60_000 },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: vi.fn(),
  },
}));

const { createShortLink, updateShortLink } = await import("../short-links.repo");

describe("short-links.repo soft-fail behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a legacy-compatible payload for direct links even when the create form sends delivery defaults", async () => {
    const createResult = {
      data: {
        id: "00000000-0000-4000-8000-00000000012d",
        account_id: "00000000-0000-4000-8000-000000000016",
        slug: "abc12345",
        target_url: "https://example.com",
      },
      error: null,
    };

    const chain = createQueryChain([createResult]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "short_links") return chain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      createShortLink("00000000-0000-4000-8000-000000000016", {
        target_url: "https://example.com",
        require_token: false,
        notify_clicks: false,
        delivery_mode: "direct_redirect",
        sales_channel_id: null,
        landing_template_key: null,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-00000000012d",
        target_url: "https://example.com",
      }),
    );

    expect(chain.insert).toHaveBeenCalledTimes(1);
    const insertPayload = chain.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(insertPayload)).not.toContain("delivery_mode");
    expect(Object.keys(insertPayload)).not.toContain("sales_channel_id");
    expect(Object.keys(insertPayload)).not.toContain("landing_template_key");
  });

  it("rejects landing-mode creation with a schema error when delivery columns are unavailable", async () => {
    const chain = createQueryChain([
      {
        throw: {
          code: "42703",
          message: "Could not find the 'delivery_mode' column of 'short_links' in the schema cache",
        },
      },
    ]);

    mockFrom.mockImplementation((table: string) => {
      if (table === "short_links") return chain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      createShortLink("00000000-0000-4000-8000-000000000016", {
        target_url: "https://example.com/landing",
        require_token: false,
        notify_clicks: false,
        delivery_mode: "landing_page",
        sales_channel_id: "550e8400-e29b-41d4-a716-446655440001",
        landing_template_key: "ctv_neutral",
      }),
    ).rejects.toBeInstanceOf(SchemaNotInitializedError);

    expect(chain.insert).toHaveBeenCalledTimes(1);
  });

  it("uses a legacy-compatible update payload when delivery defaults are not part of the requested change", async () => {
    const updateResult = {
      data: {
        id: "00000000-0000-4000-8000-00000000012d",
        account_id: "00000000-0000-4000-8000-000000000016",
        slug: "abc12345",
        title: "Updated title",
        target_url: "https://example.com",
      },
      error: null,
    };

    const chain = createQueryChain([updateResult]);
    mockFrom.mockImplementation((table: string) => {
      if (table === "short_links") return chain;
      throw new Error(`Unexpected table: ${table}`);
    });

    await expect(
      updateShortLink("00000000-0000-4000-8000-00000000012d", "00000000-0000-4000-8000-000000000016", {
        title: "Updated title",
        delivery_mode: "direct_redirect",
        landing_template_key: null,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: "00000000-0000-4000-8000-00000000012d",
        title: "Updated title",
      }),
    );

    const updatePayload = chain.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(updatePayload)).not.toContain("delivery_mode");
    expect(Object.keys(updatePayload)).not.toContain("sales_channel_id");
    expect(Object.keys(updatePayload)).not.toContain("landing_template_key");
  });
});
