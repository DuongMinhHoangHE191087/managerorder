import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNT_ID } from "@/app/api/__tests__/helpers/setup";

function createActivityLogsBuilder(rows: Array<Record<string, unknown>>) {
  const result = { data: rows, error: null, count: rows.length };
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    range: vi.fn(() => Promise.resolve(result)),
  };

  return chain;
}

async function loadRepo(supabaseAdmin: { from: ReturnType<typeof vi.fn> }) {
  vi.resetModules();
  vi.doMock("@/lib/supabase/admin", () => ({
    supabaseAdmin,
  }));
  return import("@/lib/supabase/repositories/activity-logs.repo");
}

describe("activity-logs.repo backend search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters activity logs with accent-insensitive search before pagination", async () => {
    const activityLogsBuilder = createActivityLogsBuilder([
      {
        id: "00000000-0000-4000-8000-00000000000e",
        account_id: TEST_ACCOUNT_ID,
        action_type: "CUSTOMER_UPDATED",
        created_by: "admin",
        details: { note: "Gia h\u1ea1n kh\u00e1ch gia \u0111\u00ecnh" },
        created_at: "2026-04-25T00:00:00.000Z",
        customers: { full_name: "\u0110\u1eb7ng V\u0103n L\u00e2m" },
      },
      {
        id: "00000000-0000-4000-8000-000000000010",
        account_id: TEST_ACCOUNT_ID,
        action_type: "ORDER_CREATED",
        created_by: "system",
        details: { note: "Netflix" },
        created_at: "2026-04-24T00:00:00.000Z",
        customers: { full_name: "Netflix Customer" },
      },
    ]);

    const supabaseAdmin = {
      from: vi.fn((table: string) => {
        if (table !== "activity_logs") {
          throw new Error(`Unexpected table ${table}`);
        }
        return activityLogsBuilder;
      }),
    };

    const { getActivityLogsPaginated } = await loadRepo(supabaseAdmin);
    const result = await getActivityLogsPaginated(TEST_ACCOUNT_ID, {
      search: "dang van gia han",
      page: 1,
      limit: 10,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("00000000-0000-4000-8000-00000000000e");
    expect(result.meta.count).toBe(1);
    expect(activityLogsBuilder.range).not.toHaveBeenCalled();
  });
});
