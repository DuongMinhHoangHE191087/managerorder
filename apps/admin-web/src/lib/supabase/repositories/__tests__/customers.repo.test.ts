import { describe, it, expect, vi, beforeEach } from "vitest";
import { TEST_ACCOUNT_ID } from "@/app/api/__tests__/helpers/setup";

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
};

function createQueryBuilder<T>(
  result: SupabaseResult<T>,
  terminal: "order" | "in" = "order",
  expectedOrderColumn?: string,
) {
  const resolve = () => Promise.resolve(result);
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => (terminal === "in" ? resolve() : chain)),
    order: vi.fn((column: string) => {
      if (expectedOrderColumn && column !== expectedOrderColumn) {
        return Promise.resolve({
          data: null,
          error: { message: `Unexpected order column: ${column}` },
        });
      }
      return terminal === "order" ? resolve() : chain;
    }),
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
  return import("@/lib/supabase/repositories/customers.repo");
}

describe("customers.repo relation-cache fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists customers using assigned_at for tag assignment ordering", async () => {
    const customersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "cust-1",
            full_name: "Customer One",
            type: "retail",
            created_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
      "created_at",
    );

    const contactsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "contact-1",
            customer_id: "cust-1",
            channel: "email",
            value: "customer@example.com",
            is_verified: true,
            created_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
      "created_at",
    );

    const assignmentsBuilder = createQueryBuilder(
      {
        data: [
          {
            customer_id: "cust-1",
            tag_id: "tag-1",
            assigned_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
      "assigned_at",
    );

    const ordersBuilder = createQueryBuilder(
      {
        data: [
          {
            customer_id: "cust-1",
            total_amount_vnd: 250000,
          },
        ],
        error: null,
      },
      "order",
      "created_at",
    );

    const tagsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "tag-1",
            name: "VIP",
            color: "#ef4444",
          },
        ],
        error: null,
      },
      "in",
    );

    const supabaseAdmin = createSupabaseMock({
      customers: customersBuilder,
      customer_contacts: contactsBuilder,
      customer_tag_assignments: assignmentsBuilder,
      orders: ordersBuilder,
      customer_tags: tagsBuilder,
    });

    const { listCustomers } = await loadRepo(supabaseAdmin);
    const rows = await listCustomers(TEST_ACCOUNT_ID);

    expect(rows).toHaveLength(1);
    expect(rows[0].contacts).toHaveLength(1);
    expect(rows[0].customer_tags).toHaveLength(1);
    expect(rows[0].orders).toHaveLength(1);
    expect(assignmentsBuilder.order).toHaveBeenCalledWith("assigned_at", { ascending: true });
  });
});
