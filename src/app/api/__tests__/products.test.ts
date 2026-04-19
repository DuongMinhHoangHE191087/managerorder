/**
 * Products API Route — Comprehensive Integration Tests
 * Tests: GET /api/products, POST /api/products,
 *        PUT /api/products/[id], DELETE /api/products/[id]
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

const mockListProducts = vi.fn();
const mockCreateProduct = vi.fn();
const mockUpdateProduct = vi.fn();
const mockDeleteProduct = vi.fn();
const mockGetProductById = vi.fn();
const mockCreateActivityLog = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/supabase/repositories/products.repo", () => ({
  listProducts: (...a: unknown[]) => mockListProducts(...a),
  createProduct: (...a: unknown[]) => mockCreateProduct(...a),
  updateProduct: (...a: unknown[]) => mockUpdateProduct(...a),
  deleteProduct: (...a: unknown[]) => mockDeleteProduct(...a),
  getProductById: (...a: unknown[]) => mockGetProductById(...a),
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: (...a: unknown[]) => mockCreateActivityLog(...a),
}));

vi.mock("@/lib/supabase/mappers", () => ({
  mapProductRow: (row: Record<string, unknown>) => ({
    id: row.id ?? "p-1",
    name: row.name ?? "",
    mode: row.mode ?? "slot",
    durationType: row.duration_type ?? "days",
    durationValue: row.duration_value ?? 30,
    buyPriceVnd: row.buy_price_vnd ?? 0,
    sellPriceVnd: row.sell_price_vnd ?? 0,
    isActive: row.is_active ?? true,
    createdAt: row.created_at ?? "",
  }),
}));

const mockSupabaseSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ count: 0 }),
    }),
  }),
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: mockSupabaseSelect,
    }),
  },
}));

// Dynamic imports after mocking
const { GET, POST } = await import("@/app/api/products/route");
const { PUT, DELETE } = await import("@/app/api/products/[id]/route");

beforeEach(() => {
  vi.clearAllMocks();
});

/* ============================================================
   GET /api/products
   ============================================================ */
describe("GET /api/products", () => {
  it("should return empty array when no products", async () => {
    mockListProducts.mockResolvedValue([]);
    const req = createTestRequest("http://localhost:3000/api/products");
    const res = await GET(req, { params: {} } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(mockListProducts).toHaveBeenCalledWith(TEST_ACCOUNT_ID);
  });

  it("should return mapped products", async () => {
    mockListProducts.mockResolvedValue([
      { id: "p-1", name: "Netflix", mode: "slot", sell_price_vnd: 150000 },
      { id: "p-2", name: "Spotify", mode: "key", sell_price_vnd: 60000 },
    ]);
    const req = createTestRequest("http://localhost:3000/api/products");
    const res = await GET(req, { params: {} } as any);
    const json = await res.json();

    expect(json.data).toHaveLength(2);
    expect(json.data[0].name).toBe("Netflix");
    expect(json.data[1].name).toBe("Spotify");
  });

  it("should propagate repository errors", async () => {
    mockListProducts.mockRejectedValue(new Error("DB error"));
    const req = createTestRequest("http://localhost:3000/api/products");
    const res = await GET(req, { params: {} } as any);
    expect(res.status).toBe(500);
  });
});

/* ============================================================
   POST /api/products
   ============================================================ */
describe("POST /api/products", () => {
  const validBody = {
    name: "Netflix Premium",
    mode: "slot",
    buyPriceVnd: 50000,
    sellPriceVnd: 150000,
    durationType: "months",
    durationValue: 1,
    isActive: true,
  };

  it("should create a product and return 201", async () => {
    const dbRow = {
      id: "p-new",
      name: validBody.name,
      mode: "slot",
      duration_type: "months",
      duration_value: 1,
      buy_price_vnd: 50000,
      sell_price_vnd: 150000,
      is_active: true,
      created_at: "2025-01-15T10:00:00Z",
    };
    mockCreateProduct.mockResolvedValue(dbRow);

    const req = createTestRequest("http://localhost:3000/api/products", {
      method: "POST",
      body: validBody,
    });
    const res = await POST(req, { params: {} } as any);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.name).toBe("Netflix Premium");
    expect(mockCreateProduct).toHaveBeenCalledWith(
      TEST_ACCOUNT_ID,
      expect.objectContaining({
        name: "Netflix Premium",
        mode: "slot",
        sell_price_vnd: 150000,
      })
    );
  });

  it.each(["slot", "key", "hybrid"])("should accept mode=%s", async (mode) => {
    mockCreateProduct.mockResolvedValue({ id: "p-new", name: "Test", mode });
    const req = createTestRequest("http://localhost:3000/api/products", {
      method: "POST",
      body: { ...validBody, mode },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(201);
  });

  it("should log activity on product creation", async () => {
    mockCreateProduct.mockResolvedValue({
      id: "p-new",
      name: "Test",
      mode: "slot",
      sell_price_vnd: 100000,
    });
    const req = createTestRequest("http://localhost:3000/api/products", {
      method: "POST",
      body: validBody,
    });
    await POST(req, { params: {} } as any);

    // Wait a tick for fire-and-forget
    await new Promise((r) => setTimeout(r, 10));
    expect(mockCreateActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: TEST_ACCOUNT_ID,
        action_type: "PRODUCT_CREATED",
      })
    );
  });

  it("should reject missing name", async () => {
    const { name: _, ...noName } = validBody;
    const req = createTestRequest("http://localhost:3000/api/products", {
      method: "POST",
      body: noName,
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject negative price", async () => {
    const req = createTestRequest("http://localhost:3000/api/products", {
      method: "POST",
      body: { ...validBody, sellPriceVnd: -100 },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });

  it("should reject durationValue = 0", async () => {
    const req = createTestRequest("http://localhost:3000/api/products", {
      method: "POST",
      body: { ...validBody, durationValue: 0 },
    });
    const res = await POST(req, { params: {} } as any);
    expect(res.status).toBe(400);
  });
});

/* ============================================================
   PUT /api/products/[id]
   ============================================================ */
describe("PUT /api/products/[id]", () => {
  const makeParams = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  it("should update a product", async () => {
    mockUpdateProduct.mockResolvedValue({
      id: "p-1",
      name: "Updated",
      mode: "key",
      sell_price_vnd: 200000,
    });
    const req = createTestRequest("http://localhost:3000/api/products/p-1", {
      method: "PUT",
      body: { name: "Updated", mode: "key" },
    });
    const res = await PUT(req, makeParams("p-1") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.name).toBe("Updated");
  });

  it("should accept partial update (name only)", async () => {
    mockUpdateProduct.mockResolvedValue({
      id: "p-1",
      name: "New Name",
    });
    const req = createTestRequest("http://localhost:3000/api/products/p-1", {
      method: "PUT",
      body: { name: "New Name" },
    });
    const res = await PUT(req, makeParams("p-1") as any);
    expect(res.status).toBe(200);
  });

  it("should reject price change when pending orders exist (409)", async () => {
    // Currently priced at 100k, trying to change to 200k
    mockGetProductById.mockResolvedValue({
      id: "p-1",
      sell_price_vnd: 100000,
    });
    // Simulate 3 pending orders
    mockSupabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ count: 3 }),
        }),
      }),
    });

    const req = createTestRequest("http://localhost:3000/api/products/p-1", {
      method: "PUT",
      body: { sellPriceVnd: 200000 },
    });
    const res = await PUT(req, makeParams("p-1") as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.pendingOrderCount).toBe(3);
  });

  it("should allow price change when no pending orders", async () => {
    mockGetProductById.mockResolvedValue({
      id: "p-1",
      sell_price_vnd: 100000,
    });
    mockSupabaseSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ count: 0 }),
        }),
      }),
    });
    mockUpdateProduct.mockResolvedValue({
      id: "p-1",
      sell_price_vnd: 200000,
    });

    const req = createTestRequest("http://localhost:3000/api/products/p-1", {
      method: "PUT",
      body: { sellPriceVnd: 200000 },
    });
    const res = await PUT(req, makeParams("p-1") as any);
    expect(res.status).toBe(200);
  });

  it("should skip price guard when price is unchanged", async () => {
    mockGetProductById.mockResolvedValue({
      id: "p-1",
      sell_price_vnd: 100000,
    });
    mockUpdateProduct.mockResolvedValue({ id: "p-1", sell_price_vnd: 100000 });

    const req = createTestRequest("http://localhost:3000/api/products/p-1", {
      method: "PUT",
      body: { sellPriceVnd: 100000 },
    });
    const res = await PUT(req, makeParams("p-1") as any);
    expect(res.status).toBe(200);
  });
});

/* ============================================================
   DELETE /api/products/[id]
   ============================================================ */
describe("DELETE /api/products/[id]", () => {
  const makeParams = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  it("should soft-delete a product", async () => {
    mockDeleteProduct.mockResolvedValue(undefined);
    const req = createTestRequest("http://localhost:3000/api/products/p-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("p-1") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockDeleteProduct).toHaveBeenCalledWith("p-1", TEST_ACCOUNT_ID);
  });

  it("should propagate delete errors", async () => {
    mockDeleteProduct.mockRejectedValue(new Error("Product not found"));
    const req = createTestRequest("http://localhost:3000/api/products/p-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("p-1") as any);
    expect(res.status).toBe(500);
  });
});
