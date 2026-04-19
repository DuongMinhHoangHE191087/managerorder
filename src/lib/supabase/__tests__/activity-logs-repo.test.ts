/**
 * Activity Logs Repository — Unit Tests
 * Tests: createActivityLog, getActivityLogs, getActivityLogsPaginated
 * Mocks Supabase admin client
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase admin client
const _mockSelect = vi.fn();
const _mockSingle = vi.fn();
const _mockInsert = vi.fn();
const _mockEq = vi.fn();
const _mockOrder = vi.fn();
const _mockLimit = vi.fn();
const _mockRange = vi.fn();
const _mockOr = vi.fn();
const _mockGte = vi.fn();
const _mockLt = vi.fn();

// Build a fluent chain mock
function createQueryChain(finalResult: { data?: unknown; error?: unknown; count?: number | null } = { data: null, error: null }) {
  const chain: Record<string, any> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lt = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(finalResult);
  // Make the chain itself thenable for awaiting
  chain.then = (resolve: (...args: any[]) => any) => resolve(finalResult);
  return chain;
}

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Import after mocks
const { createActivityLog, getActivityLogs, getActivityLogsPaginated } = await import(
  "@/lib/supabase/repositories/activity-logs.repo"
);

beforeEach(() => {
  vi.clearAllMocks();
});

/* ============================================================
   createActivityLog
   ============================================================ */
describe("createActivityLog", () => {
  it("should create a log entry and return it", async () => {
    const logData = {
      account_id: "acc-1",
      action_type: "ORDER_CREATED",
      customer_id: "cust-1",
      details: { order_code: "DMH_000001" },
    };
    const expectedReturn = { id: "log-1", ...logData, created_at: "2025-01-01T00:00:00Z" };
    const chain = createQueryChain({ data: expectedReturn, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await createActivityLog(logData);

    expect(mockFrom).toHaveBeenCalledWith("activity_logs");
    expect(chain.insert).toHaveBeenCalledWith([logData]);
    expect(result).toEqual(expectedReturn);
  });

  it("should return null on Supabase error (fail gracefully)", async () => {
    const chain = createQueryChain({ data: null, error: { message: "Insert failed" } });
    mockFrom.mockReturnValue(chain);

    const result = await createActivityLog({
      account_id: "acc-1",
      action_type: "ORDER_CREATED",
    });

    expect(result).toBeNull();
  });

  it("should return null on exception (fail gracefully)", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const result = await createActivityLog({
      account_id: "acc-1",
      action_type: "CUSTOMER_CREATED",
    });

    expect(result).toBeNull();
  });

  it("should handle all optional fields", async () => {
    const logData = {
      account_id: "acc-1",
      action_type: "PAYMENT_ADDED",
      customer_id: "cust-1",
      order_id: "ord-1",
      source_account_id: "inv-1",
      details: { amount: 500000 },
      created_by: "user-1",
    };
    const chain = createQueryChain({ data: { id: "log-2", ...logData, created_at: "2025-01-01" }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await createActivityLog(logData);
    expect(chain.insert).toHaveBeenCalledWith([logData]);
    expect(result).not.toBeNull();
  });
});

/* ============================================================
   getActivityLogs
   ============================================================ */
describe("getActivityLogs", () => {
  it("should fetch logs for an account", async () => {
    const logs = [
      { id: "log-1", action_type: "ORDER_CREATED", created_at: "2025-01-15T10:00:00Z" },
    ];
    const chain = createQueryChain({ data: logs, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await getActivityLogs("acc-1");
    
    expect(mockFrom).toHaveBeenCalledWith("activity_logs");
    expect(result).toEqual(logs);
  });

  it("should apply customerId filter", async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await getActivityLogs("acc-1", { customerId: "cust-1" });
    
    // Check that eq was called with customer_id
    expect(chain.eq).toHaveBeenCalledWith("account_id", "acc-1");
    expect(chain.eq).toHaveBeenCalledWith("customer_id", "cust-1");
  });

  it("should apply orderId filter", async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await getActivityLogs("acc-1", { orderId: "ord-1" });
    expect(chain.eq).toHaveBeenCalledWith("order_id", "ord-1");
  });

  it("should apply sourceAccountId filter", async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await getActivityLogs("acc-1", { sourceAccountId: "inv-1" });
    expect(chain.eq).toHaveBeenCalledWith("source_account_id", "inv-1");
  });

  it("should apply limit filter", async () => {
    const chain = createQueryChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await getActivityLogs("acc-1", { limit: 5 });
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it("should return empty array on error (fail gracefully)", async () => {
    const chain = createQueryChain({ data: null, error: { message: "Query failed" } });
    mockFrom.mockReturnValue(chain);

    const result = await getActivityLogs("acc-1");
    expect(result).toEqual([]);
  });

  it("should return empty array on exception", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("DB connection lost");
    });

    const result = await getActivityLogs("acc-1");
    expect(result).toEqual([]);
  });
});

/* ============================================================
   getActivityLogsPaginated
   ============================================================ */
describe("getActivityLogsPaginated", () => {
  it("should calculate pagination range correctly", async () => {
    const chain = createQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await getActivityLogsPaginated("acc-1", { page: 2, limit: 10 });

    // Page 2, limit 10 → from=10, to=19
    expect(chain.range).toHaveBeenCalledWith(10, 19);
  });

  it("should default to page=1, limit=20", async () => {
    const chain = createQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await getActivityLogsPaginated("acc-1");

    // Default → from=0, to=19
    expect(chain.range).toHaveBeenCalledWith(0, 19);
  });

  it("should cap limit at 100", async () => {
    const chain = createQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await getActivityLogsPaginated("acc-1", { limit: 500 });

    // 500 capped to 100 → from=0, to=99
    expect(chain.range).toHaveBeenCalledWith(0, 99);
  });

  it("should enforce minimum page=1", async () => {
    const chain = createQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await getActivityLogsPaginated("acc-1", { page: 0 });

    // 0 → page=1 → from=0
    expect(chain.range).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it("should apply actionType filter", async () => {
    const chain = createQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await getActivityLogsPaginated("acc-1", { actionType: "ORDER_CREATED" });
    expect(chain.eq).toHaveBeenCalledWith("action_type", "ORDER_CREATED");
  });

  it("should apply date range filters", async () => {
    const chain = createQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await getActivityLogsPaginated("acc-1", { startDate: "2025-01-01", endDate: "2025-01-31" });
    expect(chain.gte).toHaveBeenCalledWith("created_at", "2025-01-01");
    expect(chain.lt).toHaveBeenCalled(); // endDate + 1 day
  });

  it("should apply search via or()", async () => {
    const chain = createQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await getActivityLogsPaginated("acc-1", { search: "test" });
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining("action_type.ilike")
    );
  });

  it("should sanitize search wildcards", async () => {
    const chain = createQueryChain({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(chain);

    await getActivityLogsPaginated("acc-1", { search: "test%_injection" });
    expect(chain.or).toHaveBeenCalledWith(
      expect.stringContaining("test\\%\\_injection")
    );
  });

  it("should return proper meta structure", async () => {
    const chain = createQueryChain({ data: [{ id: "1" }, { id: "2" }], error: null, count: 50 });
    mockFrom.mockReturnValue(chain);

    const result = await getActivityLogsPaginated("acc-1", { page: 1, limit: 10 });
    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({
      count: 50,
      page: 1,
      limit: 10,
      totalPages: 5, // ceil(50/10)
    });
  });

  it("should throw on error (unlike non-paginated version)", async () => {
    const chain = createQueryChain({ data: null, error: { message: "Query failed", code: "42703" }, count: null });
    mockFrom.mockReturnValue(chain);

    await expect(getActivityLogsPaginated("acc-1")).rejects.toEqual(
      expect.objectContaining({ message: "Query failed" })
    );
  });
});
