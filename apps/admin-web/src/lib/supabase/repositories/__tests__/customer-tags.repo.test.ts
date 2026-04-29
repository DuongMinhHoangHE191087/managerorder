import { describe, it, expect, vi, beforeEach } from "vitest";

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
};

function createQueryBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "order" | "in" = "order",
) {
  const resolve = () => Promise.resolve(result);
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => (terminal === "in" ? resolve() : chain)),
    order: vi.fn(() => (terminal === "order" ? resolve() : chain)),
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
  vi.doMock("@/lib/cache/db-cache", () => ({
    cached: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    invalidate: vi.fn(),
    TTL: { LIST: 1, ITEM: 1, AGGREGATE: 1 },
  }));
  return import("@/lib/supabase/repositories/customer-tags.repo");
}

describe("customer-tags.repo base hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates customer tags from base assignment rows ordered by assigned_at", async () => {
    const assignmentsBuilder = createQueryBuilder(
      {
        data: [
          { tag_id: "00000000-0000-4000-8000-000000000030", assigned_at: "2026-04-10T00:00:00.000Z" },
          { tag_id: "00000000-0000-4000-8000-000000000115", assigned_at: "2026-04-11T00:00:00.000Z" },
        ],
        error: null,
      },
      "order",
    );

    const tagsBuilder = createQueryBuilder(
      {
        data: [
          { id: "00000000-0000-4000-8000-000000000030", account_id: "00000000-0000-4000-8000-000000000016", name: "VIP", color: "#ef4444", created_at: "2026-04-01T00:00:00.000Z" },
          { id: "00000000-0000-4000-8000-000000000115", account_id: "00000000-0000-4000-8000-000000000016", name: "Priority", color: "#22c55e", created_at: "2026-04-02T00:00:00.000Z" },
        ],
        error: null,
      },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      customer_tag_assignments: assignmentsBuilder,
      customer_tags: tagsBuilder,
    });

    const { getCustomerTags } = await loadRepo(supabaseAdmin);
    const tags = await getCustomerTags("00000000-0000-4000-8000-000000000005");

    expect(tags).toHaveLength(2);
    expect(tags[0].id).toBe("00000000-0000-4000-8000-000000000030");
    expect(tags[1].id).toBe("00000000-0000-4000-8000-000000000115");
    expect(assignmentsBuilder.order).toHaveBeenCalledWith("assigned_at", { ascending: true });
    expect(tagsBuilder.select).toHaveBeenCalledWith("id, account_id, name, color, created_at");
  });
});
