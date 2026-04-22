/**
 * ============================================================
 * ALLOCATION API — Tests
 * Covers: POST /api/inventory/allocate (suggest + confirm)
 *         DELETE /api/inventory/allocate (deallocate)
 *
 * Tests the route handler layer. Service-level logic is tested
 * separately in allocation-service.test.ts.
 * ============================================================
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  TEST_ACCOUNT_ID,
  mockRBAC,
} from "./helpers/setup";

// ── Mocks ───────────────────────────────────────────────────
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/lib/services/allocation.service", () => ({
  buildAllocationSuggestion: vi.fn(),
  confirmAllocation: vi.fn(),
  deallocateOrder: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(null),
}));

// ── Imports ─────────────────────────────────────────────────
import {
  buildAllocationSuggestion,
  confirmAllocation,
  deallocateOrder,
} from "@/lib/services/allocation.service";
import { POST, DELETE } from "@/app/api/inventory/allocate/route";

// ── Test Data ───────────────────────────────────────────────
const MOCK_SUGGESTION = {
  orderId: "order-001",
  isValid: true,
  warnings: [],
  items: [
    {
      productId: "prod-1",
      sourceAccountId: "sa-1",
      quantity: 1,
    },
  ],
};

const MOCK_CONFIRM_RESULT = {
  order: { id: "order-001", status: "provisioning" },
  suggestion: MOCK_SUGGESTION,
  message: "Allocation confirmed",
};

const MOCK_DEALLOC_RESULT = {
  deallocatedSlots: 2,
  deallocatedKeys: 1,
};

// ═════════════════════════════════════════════════════════════
// POST /api/inventory/allocate — Build Suggestion
// ═════════════════════════════════════════════════════════════
describe("POST /api/inventory/allocate — suggestion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns allocation suggestion for valid orderId", async () => {
    vi.mocked(buildAllocationSuggestion).mockResolvedValue(MOCK_SUGGESTION as any);

    const res = await POST(
      createTestRequest("http://localhost/api/inventory/allocate", {
        method: "POST",
        body: { orderId: "order-001" },
      }),
      { params: {} } as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.isValid).toBe(true);
    expect(body.message).toBe("Inventory co the cap phat");
    expect(buildAllocationSuggestion).toHaveBeenCalledWith("order-001", TEST_ACCOUNT_ID);
  });

  it("returns warning message when suggestion is not valid", async () => {
    vi.mocked(buildAllocationSuggestion).mockResolvedValue({
      ...MOCK_SUGGESTION,
      isValid: false,
      warnings: ["Không đủ slot"],
    } as any);

    const res = await POST(
      createTestRequest("http://localhost/api/inventory/allocate", {
        method: "POST",
        body: { orderId: "order-002" },
      }),
      { params: {} } as any
    );
    const body = await res.json();

    expect(body.message).toBe("Inventory chua san sang");
    expect(body.data.warnings).toContain("Không đủ slot");
  });

  it("rejects empty orderId — returns 400", async () => {
    const res = await POST(
      createTestRequest("http://localhost/api/inventory/allocate", {
        method: "POST",
        body: { orderId: "" },
      }),
      { params: {} } as any
    );

    expect(res.status).toBe(400);
    expect(buildAllocationSuggestion).not.toHaveBeenCalled();
  });

  it("rejects missing orderId — returns 400", async () => {
    const res = await POST(
      createTestRequest("http://localhost/api/inventory/allocate", {
        method: "POST",
        body: {},
      }),
      { params: {} } as any
    );

    expect(res.status).toBe(400);
  });

  it("defaults confirm to false", async () => {
    vi.mocked(buildAllocationSuggestion).mockResolvedValue(MOCK_SUGGESTION as any);

    await POST(
      createTestRequest("http://localhost/api/inventory/allocate", {
        method: "POST",
        body: { orderId: "order-001" },
      }),
      { params: {} } as any
    );

    // Should call buildAllocationSuggestion (not confirmAllocation)
    expect(buildAllocationSuggestion).toHaveBeenCalled();
    expect(confirmAllocation).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════
// POST /api/inventory/allocate — Confirm Allocation
// ═════════════════════════════════════════════════════════════
describe("POST /api/inventory/allocate — confirm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms allocation when confirm=true", async () => {
    vi.mocked(confirmAllocation).mockResolvedValue(MOCK_CONFIRM_RESULT as any);

    const res = await POST(
      createTestRequest("http://localhost/api/inventory/allocate", {
        method: "POST",
        body: { orderId: "order-001", confirm: true },
      }),
      { params: {} } as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("order-001");
    expect(body.message).toBe("Allocation confirmed");
    expect(confirmAllocation).toHaveBeenCalledWith("order-001", TEST_ACCOUNT_ID);
    expect(buildAllocationSuggestion).not.toHaveBeenCalled();
  });

  it("returns 500 when service throws", async () => {
    vi.mocked(confirmAllocation).mockRejectedValue(
      new Error("Not enough slots available")
    );

    const res = await POST(
      createTestRequest("http://localhost/api/inventory/allocate", {
        method: "POST",
        body: { orderId: "order-fail", confirm: true },
      }),
      { params: {} } as any
    );

    expect(res.status).toBe(500);
  });
});

// ═════════════════════════════════════════════════════════════
// DELETE /api/inventory/allocate — Deallocate
// ═════════════════════════════════════════════════════════════
describe("DELETE /api/inventory/allocate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deallocates order and returns result", async () => {
    vi.mocked(deallocateOrder).mockResolvedValue(MOCK_DEALLOC_RESULT as any);

    const res = await DELETE(
      createTestRequest(
        "http://localhost/api/inventory/allocate?orderId=order-001",
        { method: "DELETE" }
      ),
      { params: {} } as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.deallocatedSlots).toBe(2);
    expect(body.data.deallocatedKeys).toBe(1);
    expect(body.message).toContain("2 slot");
    expect(body.message).toContain("1 key");
    expect(deallocateOrder).toHaveBeenCalledWith("order-001", TEST_ACCOUNT_ID);
  });

  it("rejects request without orderId — returns 400", async () => {
    const res = await DELETE(
      createTestRequest("http://localhost/api/inventory/allocate", {
        method: "DELETE",
      }),
      { params: {} } as any
    );

    expect(res.status).toBe(400);
    expect(deallocateOrder).not.toHaveBeenCalled();
  });

  it("returns 500 when deallocation fails", async () => {
    vi.mocked(deallocateOrder).mockRejectedValue(new Error("Order not found"));

    const res = await DELETE(
      createTestRequest(
        "http://localhost/api/inventory/allocate?orderId=bad-order",
        { method: "DELETE" }
      ),
      { params: {} } as any
    );

    expect(res.status).toBe(500);
  });
});
