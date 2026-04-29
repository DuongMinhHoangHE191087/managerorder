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
            id: "00000000-0000-4000-8000-000000000005",
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
            id: "00000000-0000-4000-8000-000000000001",
            customer_id: "00000000-0000-4000-8000-000000000005",
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
            customer_id: "00000000-0000-4000-8000-000000000005",
            tag_id: "00000000-0000-4000-8000-000000000030",
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
            customer_id: "00000000-0000-4000-8000-000000000005",
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
            id: "00000000-0000-4000-8000-000000000030",
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

  it("filters customer list with accent-insensitive backend search", async () => {
    const customersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "00000000-0000-4000-8000-000000000005",
            full_name: "\u0110\u1eb7ng V\u0103n L\u00e2m",
            type: "retail",
            notes: "Kh\u00e1ch gia \u0111\u00ecnh",
            created_at: "2026-04-10T00:00:00.000Z",
          },
          {
            id: "00000000-0000-4000-8000-000000000006",
            full_name: "Netflix Customer",
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
            id: "00000000-0000-4000-8000-000000000001",
            customer_id: "00000000-0000-4000-8000-000000000005",
            channel: "zalo",
            value: "0394497949",
            is_verified: true,
            created_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
      "created_at",
    );

    const assignmentsBuilder = createQueryBuilder({ data: [], error: null }, "order", "assigned_at");
    const ordersBuilder = createQueryBuilder({ data: [], error: null }, "order", "created_at");

    const supabaseAdmin = createSupabaseMock({
      customers: customersBuilder,
      customer_contacts: contactsBuilder,
      customer_tag_assignments: assignmentsBuilder,
      orders: ordersBuilder,
    });

    const { listCustomers } = await loadRepo(supabaseAdmin);
    const rows = await listCustomers(TEST_ACCOUNT_ID, { search: "dang van gia dinh" });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("00000000-0000-4000-8000-000000000005");
  });

  it("retries contact insert without facebook columns when schema cache is stale", async () => {
    const insertedContactPayloads: Array<Record<string, unknown>[]> = [];

    const customersBuilder = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: "cust-new",
                full_name: "Khách mới",
                type: "retail",
                created_at: "2026-04-24T00:00:00.000Z",
                updated_at: "2026-04-24T00:00:00.000Z",
              },
              error: null,
            }),
          ),
        })),
      })),
    };

    const customerContactsBuilder = {
      insert: vi.fn((rows: Record<string, unknown>[]) => {
        insertedContactPayloads.push(rows);
        if (insertedContactPayloads.length === 1) {
          return {
            select: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: {
                  message:
                    "Could not find the 'facebook_id' column of 'customer_contacts' in the schema cache",
                },
              }),
            ),
          };
        }

        return {
          select: vi.fn(() =>
            Promise.resolve({
              data: rows.map((row, index) => ({
                ...row,
                id: `contact-${index + 1}`,
                created_at: "2026-04-24T00:00:00.000Z",
              })),
              error: null,
            }),
          ),
        };
      }),
    };

    const supabaseAdmin = createSupabaseMock({
      customers: customersBuilder,
      customer_contacts: customerContactsBuilder,
    });

    const { createCustomer } = await loadRepo(supabaseAdmin);
    const created = await createCustomer(TEST_ACCOUNT_ID, {
      full_name: "Khách mới",
      type: "retail",
      contacts: [
        {
          channel: "zalo",
          value: "zalo-khach-moi",
          facebook_id: "00000000-0000-4000-8000-000000000118",
          facebook_name: "Facebook Khách Mới",
        },
      ],
    });

    expect(created.id).toBe("cust-new");
    expect(created.contacts).toHaveLength(1);
    expect(insertedContactPayloads).toHaveLength(2);
    expect(insertedContactPayloads[0][0]).toMatchObject({
      facebook_id: "00000000-0000-4000-8000-000000000118",
      facebook_name: "Facebook Khách Mới",
    });
    expect(insertedContactPayloads[1][0]).not.toHaveProperty("facebook_id");
    expect(insertedContactPayloads[1][0]).not.toHaveProperty("facebook_name");
  });

  it("drops optional contact columns progressively when multiple columns are missing", async () => {
    const insertedContactPayloads: Array<Record<string, unknown>[]> = [];

    const customersBuilder = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: {
                id: "00000000-0000-4000-8000-000000000119",
                full_name: "Khách mới 2",
                type: "retail",
                created_at: "2026-04-24T00:00:00.000Z",
                updated_at: "2026-04-24T00:00:00.000Z",
              },
              error: null,
            }),
          ),
        })),
      })),
    };

    const customerContactsBuilder = {
      insert: vi.fn((rows: Record<string, unknown>[]) => {
        insertedContactPayloads.push(rows);
        if (insertedContactPayloads.length === 1) {
          return {
            select: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: {
                  message:
                    "Could not find the 'facebook_id' column of 'customer_contacts' in the schema cache",
                },
              }),
            ),
          };
        }
        if (insertedContactPayloads.length === 2) {
          return {
            select: vi.fn(() =>
              Promise.resolve({
                data: null,
                error: {
                  message:
                    "Could not find the 'is_primary' column of 'customer_contacts' in the schema cache",
                },
              }),
            ),
          };
        }

        return {
          select: vi.fn(() =>
            Promise.resolve({
              data: rows.map((row, index) => ({
                ...row,
                id: `contact-${index + 1}`,
                created_at: "2026-04-24T00:00:00.000Z",
              })),
              error: null,
            }),
          ),
        };
      }),
    };

    const supabaseAdmin = createSupabaseMock({
      customers: customersBuilder,
      customer_contacts: customerContactsBuilder,
    });

    const { createCustomer } = await loadRepo(supabaseAdmin);
    const created = await createCustomer(TEST_ACCOUNT_ID, {
      full_name: "Khách mới 2",
      type: "retail",
      contacts: [
        {
          channel: "phone",
          value: "0909000222",
          is_primary: true,
          facebook_id: "00000000-0000-4000-8000-00000000011a",
          facebook_name: "FB 2",
        },
      ],
    });

    expect(created.id).toBe("00000000-0000-4000-8000-000000000119");
    expect(created.contacts).toHaveLength(1);
    expect(insertedContactPayloads).toHaveLength(3);
    expect(insertedContactPayloads[0][0]).toHaveProperty("facebook_id");
    expect(insertedContactPayloads[1][0]).not.toHaveProperty("facebook_id");
    expect(insertedContactPayloads[1][0]).toHaveProperty("is_primary");
    expect(insertedContactPayloads[2][0]).not.toHaveProperty("is_primary");
  });
});
