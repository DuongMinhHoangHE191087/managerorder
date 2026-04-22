/**
 * Customers Batch API — Comprehensive Integration Tests
 * Tests: POST /api/customers/batch (delete, update_tier, check_dependencies)
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

const mockSoftDeleteCustomers = vi.fn();
const mockUpdateCustomersTier = vi.fn();
const mockGetCustomerDependencies = vi.fn();

vi.mock("@/lib/supabase/repositories/customers.repo", () => ({
  softDeleteCustomers: (...a: unknown[]) => mockSoftDeleteCustomers(...a),
  updateCustomersTier: (...a: unknown[]) => mockUpdateCustomersTier(...a),
  getCustomerDependencies: (...a: unknown[]) => mockGetCustomerDependencies(...a),
}));

vi.mock("@/lib/supabase/mappers/customer-mapper", () => ({
  mapTierToDbType: (tier: string) =>
    tier === "vip" ? "wholesale" : tier === "agency" ? "agency" : "retail",
}));

const { POST } = await import("@/app/api/customers/batch/route");

const uuid = () => crypto.randomUUID();

beforeEach(() => {
  vi.clearAllMocks();
});

/* ============================================================
   Batch Schema Validation
   ============================================================ */
describe("Batch — Schema Validation", () => {
  it("should reject missing action", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { customerIds: [uuid()] },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject invalid action", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "explode", customerIds: [uuid()] },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject empty customerIds array", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "delete", customerIds: [] },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject non-UUID customerIds", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "delete", customerIds: ["not-a-uuid"] },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

/* ============================================================
   Batch — check_dependencies
   ============================================================ */
describe("Batch — check_dependencies", () => {
  it("should return dependency counts", async () => {
    const ids = [uuid(), uuid()];
    mockGetCustomerDependencies.mockResolvedValue({
      customersWithOrders: 1,
      totalOrders: 5,
    });

    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "check_dependencies", customerIds: ids },
    });
    const res = await POST(req, { params: {} } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.customersWithOrders).toBe(1);
    expect(json.data.totalOrders).toBe(5);
  });

  it("should return zero when no dependencies", async () => {
    mockGetCustomerDependencies.mockResolvedValue({
      customersWithOrders: 0,
      totalOrders: 0,
    });
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "check_dependencies", customerIds: [uuid()] },
    });
    const res = await POST(req, { params: {} } as any);
    const json = await res.json();

    expect(json.data.customersWithOrders).toBe(0);
    expect(json.data.totalOrders).toBe(0);
  });

  it("should chunk large lists (> 50) into batches", async () => {
    const ids = Array.from({ length: 75 }, () => uuid());
    mockGetCustomerDependencies.mockResolvedValue({
      customersWithOrders: 0,
      totalOrders: 0,
    });

    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "check_dependencies", customerIds: ids },
    });
    await POST(req, { params: {} } as any);

    // 75 ids → 2 chunks (50 + 25)
    expect(mockGetCustomerDependencies).toHaveBeenCalledTimes(2);
  });
});

/* ============================================================
   Batch — delete
   ============================================================ */
describe("Batch — delete", () => {
  it("should soft-delete customers and return count", async () => {
    const ids = [uuid(), uuid(), uuid()];
    mockSoftDeleteCustomers.mockResolvedValue(3);

    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "delete", customerIds: ids },
    });
    const res = await POST(req, { params: {} } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deletedCount).toBe(3);
    expect(json.message).toContain("3");
  });

  it("should chunk large delete (> 50) into batches", async () => {
    const ids = Array.from({ length: 120 }, () => uuid());
    mockSoftDeleteCustomers.mockResolvedValue(50);

    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "delete", customerIds: ids },
    });
    const res = await POST(req, { params: {} } as any);
    const json = await res.json();

    // 120 ids → 3 chunks (50 + 50 + 20)
    expect(mockSoftDeleteCustomers).toHaveBeenCalledTimes(3);
    expect(json.data.deletedCount).toBe(150); // 50*3
  });
});

/* ============================================================
   Batch — update_tier
   ============================================================ */
describe("Batch — update_tier", () => {
  it("should update tier via tier field", async () => {
    const ids = [uuid()];
    mockUpdateCustomersTier.mockResolvedValue(1);

    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: {
        action: "update_tier",
        customerIds: ids,
        data: { tier: "vip" },
      },
    });
    const res = await POST(req, { params: {} } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.updatedCount).toBe(1);
    expect(mockUpdateCustomersTier).toHaveBeenCalledWith(
      ids,
      TEST_ACCOUNT_ID,
      "wholesale" // vip → wholesale
    );
  });

  it("should update via customerType directly", async () => {
    const ids = [uuid()];
    mockUpdateCustomersTier.mockResolvedValue(1);

    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: {
        action: "update_tier",
        customerIds: ids,
        data: { customerType: "agency" },
      },
    });
    const res = await POST(req, { params: {} } as any);

    expect(res.status).toBe(200);
    expect(mockUpdateCustomersTier).toHaveBeenCalledWith(
      ids,
      TEST_ACCOUNT_ID,
      "agency"
    );
  });

  it("should return 400 when missing tier data", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: {
        action: "update_tier",
        customerIds: [uuid()],
        data: {},
      },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should return 400 when no data object", async () => {
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: {
        action: "update_tier",
        customerIds: [uuid()],
      },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

/* ============================================================
   EDGE CASES & ERROR PROPAGATION
   ============================================================ */
describe("Batch — error scenarios", () => {
  it("should return 500 when softDeleteCustomers throws", async () => {
    mockSoftDeleteCustomers.mockRejectedValue(new Error("DB write failed"));
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "delete", customerIds: [uuid()] },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("should return 500 when updateCustomersTier throws", async () => {
    mockUpdateCustomersTier.mockRejectedValue(new Error("DB update failed"));
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: {
        action: "update_tier",
        customerIds: [uuid()],
        data: { tier: "regular" },
      },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("should return 500 when getCustomerDependencies throws", async () => {
    mockGetCustomerDependencies.mockRejectedValue(new Error("Read failed"));
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "check_dependencies", customerIds: [uuid()] },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });

  it("should delete single customer successfully", async () => {
    const id = uuid();
    mockSoftDeleteCustomers.mockResolvedValue(1);
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: { action: "delete", customerIds: [id] },
    });
    const res = await POST(req, { params: {} } as any);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.deletedCount).toBe(1);
  });

  it("should map agency tier correctly in update_tier", async () => {
    const ids = [uuid()];
    mockUpdateCustomersTier.mockResolvedValue(1);
    const req = createTestRequest("http://localhost:3000/api/customers/batch", {
      method: "POST",
      body: {
        action: "update_tier",
        customerIds: ids,
        data: { tier: "agency" },
      },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(200);
    expect(mockUpdateCustomersTier).toHaveBeenCalledWith(ids, TEST_ACCOUNT_ID, "agency");
  });
});
