import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest, mockRBAC } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  getOrdersPaginated: vi.fn(),
}));
vi.mock("@/lib/services/order.service", () => ({
  createOrderWithItems: vi.fn(),
}));
vi.mock("@/lib/utils/api-helpers", () => ({
  getPaginationParams: vi.fn((sp: URLSearchParams) => ({
    page: parseInt(sp.get("page") || "1"),
    limit: parseInt(sp.get("limit") || "20"),
    offset: 0,
  })),
}));

import { getOrdersPaginated } from "@/lib/supabase/repositories/orders.repo";
import { createOrderWithItems } from "@/lib/services/order.service";
import { GET, POST } from "@/app/api/orders/route";

describe("GET /api/orders", () => {
  const mockResult = {
    data: [{ id: "o1", status: "completed" }],
    count: 1, page: 1, limit: 20, totalPages: 1,
    source: "database" as const,
  };

  beforeEach(() => {
    vi.mocked(getOrdersPaginated).mockResolvedValue(mockResult);
  });

  it("returns paginated orders with meta", async () => {
    const res = await GET(createTestRequest("http://localhost/api/orders?page=1&limit=20"), { params: {} } as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.meta.count).toBe(1);
  });

  it("passes filter params (search, status, customer_id)", async () => {
    await GET(createTestRequest("http://localhost/api/orders?search=DMH&status=completed&customer_id=c1"), { params: {} } as any);
    expect(getOrdersPaginated).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ search: "DMH", status: "completed", customerId: "c1" })
    );
  });

  it("handles empty result", async () => {
    vi.mocked(getOrdersPaginated).mockResolvedValue({
      data: [],
      count: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      source: "database" as const,
    });
    const res = await GET(createTestRequest("http://localhost/api/orders"), { params: {} } as any);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe("POST /api/orders", () => {
  const validBody = {
    customerId: "00000000-0000-4000-8000-000000000005",
    productId: "00000000-0000-4000-8000-000000000039",
    items: [{ nick: "p1", productId: "00000000-0000-4000-8000-000000000039", quantity: 1, unitPriceVnd: 50000 }],
    totalAmountVnd: 50000,
    status: "pending_payment",
  };

  beforeEach(() => {
    vi.mocked(createOrderWithItems).mockResolvedValue({
      order: { id: "new-o1", status: "pending_payment" } as any,
      items: [{ id: "00000000-0000-4000-8000-000000000058" }] as any,
    });
  });

  it("creates order and returns 201", async () => {
    const res = await POST(createTestRequest("http://localhost/api/orders", { method: "POST", body: validBody }), { params: {} } as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("new-o1");
  });

  it("returns error when service throws with status", async () => {
    vi.mocked(createOrderWithItems).mockRejectedValue(
      Object.assign(new Error("Duplicate"), { status: 409 })
    );
    const res = await POST(createTestRequest("http://localhost/api/orders", { method: "POST", body: validBody }), { params: {} } as any);
    expect(res.status).toBe(409);
  });

  it("rejects invalid body", async () => {
    const res = await POST(createTestRequest("http://localhost/api/orders", { method: "POST", body: { items: [] } }), { params: {} } as any);
    expect(res.status).toBe(400);
  });
});
