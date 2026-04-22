import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
} from "./helpers/setup";

// Mock middleware
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

// Mock supabaseAdmin
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock calculateRfm
const mockCalculateRfm = vi.fn();
vi.mock("@/lib/services/rfm-calculator", () => ({
  calculateRfm: (...args: unknown[]) => mockCalculateRfm(...args),
}));

import { POST } from "@/app/api/customers/recalculate-rfm/route";

// ── Helpers ──────────────────────────────────────────────────

function createRfmRequest() {
  return createTestRequest(
    "http://localhost:3000/api/customers/recalculate-rfm",
    { method: "POST" }
  );
}

function mockOrdersQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

function mockCustomersQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ data, error }),
  };
}

function mockUpdateChain(error: unknown = null) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error }),
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

// ── Tests ────────────────────────────────────────────────────

describe("POST /api/customers/recalculate-rfm", () => {
  it("recalculates RFM for all customers successfully", async () => {
    const orders = [
      {
        customer_id: "c1",
        total_amount_vnd: 200000,
        created_at: "2024-05-01",
      },
      {
        customer_id: "c1",
        total_amount_vnd: 300000,
        created_at: "2024-03-01",
      },
      {
        customer_id: "c2",
        total_amount_vnd: 100000,
        created_at: "2024-04-01",
      },
    ];

    const customers = [{ id: "c1" }, { id: "c2" }];

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return mockOrdersQuery(orders);
      if (table === "customers") {
        fromCallCount++;
        // First call: select customers; subsequent: update
        if (fromCallCount === 1) return mockCustomersQuery(customers);
        return mockUpdateChain();
      }
      return mockCustomersQuery([]);
    });

    mockCalculateRfm.mockReturnValue({
      segment: "loyal",
      recency: 8,
      frequency: 7,
      monetary: 9,
      score: 85,
    });

    const response = await POST(createRfmRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.totalCustomers).toBe(2);
    expect(json.updatedCount).toBe(2);
    expect(json.calculatedAt).toBeDefined();

    // Verify calculateRfm was called for each customer
    expect(mockCalculateRfm).toHaveBeenCalledTimes(2);

    // Verify c1 received correct aggregated data
    const c1Call = mockCalculateRfm.mock.calls.find(
      (call) => call[0].customerId === "c1"
    );
    expect(c1Call).toBeDefined();
    expect(c1Call![0].totalOrders).toBe(2);
    expect(c1Call![0].totalSpentVnd).toBe(500000);
    expect(c1Call![0].lastOrderDate).toBe("2024-05-01");
  });

  it("handles customers with no orders (RFM defaults)", async () => {
    const customers = [{ id: "c1" }];

    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return mockOrdersQuery([]);
      if (table === "customers") {
        return {
          ...mockCustomersQuery(customers),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return mockCustomersQuery([]);
    });

    mockCalculateRfm.mockReturnValue({
      segment: "new",
      recency: 1,
      frequency: 1,
      monetary: 1,
      score: 10,
    });

    const response = await POST(createRfmRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.totalCustomers).toBe(1);

    // Verify calculateRfm was called with zero order data
    expect(mockCalculateRfm).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "c1",
        totalOrders: 0,
        totalSpentVnd: 0,
        lastOrderDate: null,
      }),
      expect.any(Date)
    );
  });

  it("returns 500 when orders query fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return mockOrdersQuery(null, { message: "Orders DB error" });
      }
      return mockCustomersQuery([]);
    });

    const response = await POST(createRfmRequest(), { params: {} } as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Failed to aggregate order data");
  });

  it("returns 500 when customers query fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return mockOrdersQuery([]);
      if (table === "customers") {
        return mockCustomersQuery(null, { message: "Customers DB error" });
      }
      return mockCustomersQuery([]);
    });

    const response = await POST(createRfmRequest(), { params: {} } as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Failed to fetch customers");
  });

  it("handles empty customer list gracefully", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return mockOrdersQuery([]);
      if (table === "customers") return mockCustomersQuery([]);
      return mockCustomersQuery([]);
    });

    const response = await POST(createRfmRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.totalCustomers).toBe(0);
    expect(json.updatedCount).toBe(0);
    expect(mockCalculateRfm).not.toHaveBeenCalled();
  });

  it("counts only successful updates in updatedCount", async () => {
    const customers = [{ id: "c1" }, { id: "c2" }];

    let updateCall = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "orders") return mockOrdersQuery([]);
      if (table === "customers") {
        const base = mockCustomersQuery(customers);
        return {
          ...base,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              updateCall++;
              if (updateCall === 2) {
                return Promise.resolve({
                  error: { message: "Update failed" },
                });
              }
              return Promise.resolve({ error: null });
            }),
          }),
        };
      }
      return mockCustomersQuery([]);
    });

    mockCalculateRfm.mockReturnValue({
      segment: "regular",
      recency: 5,
      frequency: 5,
      monetary: 5,
      score: 50,
    });

    const response = await POST(createRfmRequest(), { params: {} } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.totalCustomers).toBe(2);
    // Only 1 succeeded, 1 failed
    expect(json.updatedCount).toBe(1);
  });
});
