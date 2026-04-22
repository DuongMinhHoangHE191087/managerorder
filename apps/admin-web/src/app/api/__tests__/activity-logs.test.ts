/**
 * Activity Logs API Route — Comprehensive Integration Tests
 * Tests: GET (pagination, filters, search, date range, entity filters, error handling)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  TEST_ACCOUNT_ID,
} from "./helpers/setup";

// --- Mocks ---
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

const mockGetActivityLogsPaginated = vi.fn();

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  getActivityLogsPaginated: (...args: unknown[]) => mockGetActivityLogsPaginated(...args),
}));

// Dynamic import (after mocks)
const { GET } = await import("@/app/api/activity-logs/route");

beforeEach(() => {
  vi.clearAllMocks();
});

/* ============================================================
   GET /api/activity-logs — Pagination
   ============================================================ */
describe("GET /api/activity-logs — Pagination", () => {
  const emptyResponse = { data: [], meta: { count: 0, page: 1, limit: 20, totalPages: 0 } };

  it("should return paginated logs with defaults (page=1, limit=20)", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest("http://localhost:3000/api/activity-logs");
    const res = await GET(req, { params: {} } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(emptyResponse);
    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(TEST_ACCOUNT_ID, {
      page: 1,
      limit: 20,
      search: undefined,
      actionType: undefined,
      customerId: undefined,
      orderId: undefined,
      sourceAccountId: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("should pass custom page and limit", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue({
      data: [], meta: { count: 0, page: 3, limit: 10, totalPages: 0 },
    });
    const req = createTestRequest("http://localhost:3000/api/activity-logs?page=3&limit=10");
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(TEST_ACCOUNT_ID, expect.objectContaining({
      page: 3,
      limit: 10,
    }));
  });

  it("should ignore non-numeric page/limit and use defaults", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest("http://localhost:3000/api/activity-logs?page=abc&limit=xyz");
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(TEST_ACCOUNT_ID, expect.objectContaining({
      page: 1,
      limit: 20,
    }));
  });

  it("should return logs with data", async () => {
    const logs = [
      { id: "log-1", action_type: "ORDER_CREATED", created_at: "2025-01-15T10:00:00Z", customers: null, orders: { id: "ord-1", status: "pending" }, inventory_accounts: null },
      { id: "log-2", action_type: "CUSTOMER_CREATED", created_at: "2025-01-15T09:00:00Z", customers: { full_name: "Test" }, orders: null, inventory_accounts: null },
    ];
    mockGetActivityLogsPaginated.mockResolvedValue({
      data: logs,
      meta: { count: 2, page: 1, limit: 20, totalPages: 1 },
    });

    const req = createTestRequest("http://localhost:3000/api/activity-logs");
    const res = await GET(req, { params: {} } as any);
    const json = await res.json();

    expect(json.data).toHaveLength(2);
    expect(json.meta.count).toBe(2);
  });
});

/* ============================================================
   GET /api/activity-logs — Filters
   ============================================================ */
describe("GET /api/activity-logs — Filters", () => {
  const emptyResponse = { data: [], meta: { count: 0, page: 1, limit: 20, totalPages: 0 } };

  it("should pass search filter", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest("http://localhost:3000/api/activity-logs?search=order");
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ search: "order" })
    );
  });

  it("should pass actionType filter", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest("http://localhost:3000/api/activity-logs?actionType=ORDER_CREATED");
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ actionType: "ORDER_CREATED" })
    );
  });

  it("should pass customerId filter", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest("http://localhost:3000/api/activity-logs?customerId=cust-123");
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ customerId: "cust-123" })
    );
  });

  it("should pass orderId filter", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest("http://localhost:3000/api/activity-logs?orderId=ord-456");
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ orderId: "ord-456" })
    );
  });

  it("should pass sourceAccountId filter", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest("http://localhost:3000/api/activity-logs?sourceAccountId=inv-789");
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({ sourceAccountId: "inv-789" })
    );
  });

  it("should pass date range filters", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest("http://localhost:3000/api/activity-logs?startDate=2025-01-01&endDate=2025-01-31");
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      })
    );
  });

  it("should combine multiple filters", async () => {
    mockGetActivityLogsPaginated.mockResolvedValue(emptyResponse);
    const req = createTestRequest(
      "http://localhost:3000/api/activity-logs?page=2&limit=5&search=test&actionType=PAYMENT_ADDED&customerId=c1&startDate=2025-01-01"
    );
    await GET(req, { params: {} } as any);

    expect(mockGetActivityLogsPaginated).toHaveBeenCalledWith(TEST_ACCOUNT_ID, {
      page: 2,
      limit: 5,
      search: "test",
      actionType: "PAYMENT_ADDED",
      customerId: "c1",
      orderId: undefined,
      sourceAccountId: undefined,
      startDate: "2025-01-01",
      endDate: undefined,
    });
  });
});

/* ============================================================
   GET /api/activity-logs — Error Handling
   ============================================================ */
describe("GET /api/activity-logs — Error Handling", () => {
  it("should propagate repository errors as 500", async () => {
    mockGetActivityLogsPaginated.mockRejectedValue(new Error("Database timeout"));
    const req = createTestRequest("http://localhost:3000/api/activity-logs");
    const res = await GET(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("should handle Supabase-style errors", async () => {
    mockGetActivityLogsPaginated.mockRejectedValue({
      code: "42703",
      message: "column does not exist",
    });
    const req = createTestRequest("http://localhost:3000/api/activity-logs");
    const res = await GET(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });
});
