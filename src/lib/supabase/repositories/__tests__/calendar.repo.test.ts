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
    is: vi.fn(() => chain),
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
  return import("@/lib/supabase/repositories/calendar.repo");
}

describe("calendar.repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches customers and contacts via manual hydrate", async () => {
    const eventsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "rem-1",
            account_id: TEST_ACCOUNT_ID,
            title: "Follow up",
            due_at: "2026-04-11T00:00:00.000Z",
            customer_id: null,
            customer_ids: ["cust-1"],
            has_reminder: true,
            is_done: false,
            notes: null,
            type: "call",
            created_at: "2026-04-10T00:00:00.000Z",
            updated_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
    );

    const customersBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "cust-1",
            full_name: "Calendar Customer",
            type: "retail",
          },
        ],
        error: null,
      },
      "in",
    );

    const contactsBuilder = createQueryBuilder(
      {
        data: [
          {
            id: "ct-1",
            customer_id: "cust-1",
            channel: "zalo",
            value: "0900000000",
            is_primary: true,
            created_at: "2026-04-10T00:00:00.000Z",
          },
        ],
        error: null,
      },
      "order",
    );

    const supabaseAdmin = createSupabaseMock({
      reminder_events: eventsBuilder,
      customers: customersBuilder,
      customer_contacts: contactsBuilder,
    });

    const { listCalendarEvents } = await loadRepo(supabaseAdmin);
    const events = await listCalendarEvents(TEST_ACCOUNT_ID);

    expect(events).toHaveLength(1);
    expect(events[0]._customers[0]).toEqual(expect.objectContaining({
      full_name: "Calendar Customer",
      customer_contacts: [expect.objectContaining({ channel: "zalo", value: "0900000000" })],
    }));
  });
});
