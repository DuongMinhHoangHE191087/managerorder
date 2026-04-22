import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
} from "./helpers/setup";

// Mock middleware BEFORE importing route
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

// Mock supabaseAdmin
const _mockSelect = vi.fn();
const _mockEq = vi.fn();
const _mockIs = vi.fn();
const _mockSingle = vi.fn();
const _mockOrder = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { GET } from "@/app/api/customers/[id]/stats/route";

// ── Helpers ──────────────────────────────────────────────────

const CUSTOMER_ID = "cust-001";

function createStatsRequest() {
  return createTestRequest(
    `http://localhost:3000/api/customers/${CUSTOMER_ID}/stats`
  );
}

function mockChain(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    order: vi.fn().mockResolvedValue({ data, error }),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

const mockCustomer = {
  id: CUSTOMER_ID,
  full_name: "Nguyễn Văn Test",
  segment: "loyal",
  rfm_score: 80,
  rfm_recency: 7,
  rfm_frequency: 6,
  rfm_monetary: 8,
  last_rfm_calculated_at: "2024-06-01T00:00:00Z",
  debt_amount_vnd: 500000,
  debt_overdue_days: 10,
  reliability_score: 85,
};

const mockOrders = [
  { id: "o1", total_amount_vnd: 200000, created_at: "2024-01-15", status: "paid" },
  { id: "o2", total_amount_vnd: 300000, created_at: "2024-03-20", status: "active" },
  { id: "o3", total_amount_vnd: 150000, created_at: "2024-05-10", status: "paid" },
];

const mockPayments = [
  { amount_vnd: 100000, created_at: "2024-02-01" },
  { amount_vnd: 200000, created_at: "2024-04-01" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────

describe("GET /api/customers/[id]/stats", () => {
  it("returns full 360° stats for a valid customer", async () => {
    // 1st call: customers (single)
    const custChain = mockChain(mockCustomer);
    // 2nd call: orders
    const orderChain = mockChain(mockOrders);
    // 3rd call: payments
    const paymentChain = mockChain(mockPayments);

    const _callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") return custChain;
      if (table === "orders") return orderChain;
      if (table === "payments") return paymentChain;
      return mockChain(null);
    });

    const request = createStatsRequest();
    const response = await GET(request, {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();

    // Order stats
    expect(json.customerId).toBe(CUSTOMER_ID);
    expect(json.totalOrders).toBe(3);
    expect(json.totalSpentVnd).toBe(650000);
    expect(json.avgOrderValueVnd).toBe(Math.round(650000 / 3));
    expect(json.firstOrderDate).toBe("2024-01-15");
    expect(json.lastOrderDate).toBe("2024-05-10");

    // Orders by status
    expect(json.ordersByStatus.paid).toBe(2);
    expect(json.ordersByStatus.active).toBe(1);

    // Payment stats
    expect(json.totalPaymentsVnd).toBe(300000);
    expect(json.outstandingDebtVnd).toBe(350000);

    // RFM
    expect(json.segment).toBe("loyal");
    expect(json.rfmScore).toBe(80);

    // Debt
    expect(json.debtAmountVnd).toBe(500000);
    expect(json.reliabilityScore).toBe(85);
  });

  it("returns 404 when customer not found", async () => {
    const custChain = mockChain(null, { message: "Not found" });
    mockFrom.mockImplementation(() => custChain);

    const request = createStatsRequest();
    const response = await GET(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Customer not found");
  });

  it("returns zero stats when customer has no orders", async () => {
    const custChain = mockChain(mockCustomer);
    const orderChain = mockChain([]);
    const paymentChain = mockChain([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") return custChain;
      if (table === "orders") return orderChain;
      if (table === "payments") return paymentChain;
      return mockChain(null);
    });

    const request = createStatsRequest();
    const response = await GET(request, {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.totalOrders).toBe(0);
    expect(json.totalSpentVnd).toBe(0);
    expect(json.avgOrderValueVnd).toBe(0);
    expect(json.firstOrderDate).toBeNull();
    expect(json.lastOrderDate).toBeNull();
    expect(json.totalPaymentsVnd).toBe(0);
    expect(json.outstandingDebtVnd).toBe(0);
  });

  it("returns 500 when orders query fails", async () => {
    const custChain = mockChain(mockCustomer);
    const orderChain = mockChain(null, { message: "DB error" });

    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") return custChain;
      if (table === "orders") return orderChain;
      return mockChain(null);
    });

    const request = createStatsRequest();
    const response = await GET(request, {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Failed to fetch orders");
  });

  it("handles null order amounts gracefully", async () => {
    const ordersWithNull = [
      { id: "o1", total_amount_vnd: null, created_at: "2024-01-01", status: "paid" },
      { id: "o2", total_amount_vnd: 100000, created_at: "2024-02-01", status: "paid" },
    ];

    const custChain = mockChain(mockCustomer);
    const orderChain = mockChain(ordersWithNull);
    const paymentChain = mockChain([]);

    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") return custChain;
      if (table === "orders") return orderChain;
      if (table === "payments") return paymentChain;
      return mockChain(null);
    });

    const request = createStatsRequest();
    const response = await GET(request, {
      params: Promise.resolve({ id: CUSTOMER_ID }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.totalSpentVnd).toBe(100000);
    expect(json.totalOrders).toBe(2);
  });
});
