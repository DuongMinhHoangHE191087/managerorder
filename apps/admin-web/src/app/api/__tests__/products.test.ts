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

vi.mock("@/domains/products", () => ({
  listProductsForAccount: (...a: unknown[]) => mockListProducts(...a),
  createProductForAccount: (...a: unknown[]) => mockCreateProduct(...a),
  updateProductForAccount: (...a: unknown[]) => mockUpdateProduct(...a),
  deleteProductForAccount: (...a: unknown[]) => mockDeleteProduct(...a),
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
      { id: "00000000-0000-4000-8000-0000000003ed", name: "Netflix", mode: "slot", sellPriceVnd: 150000 },
      { id: "00000000-0000-4000-8000-0000000003ee", name: "Spotify", mode: "key", sellPriceVnd: 60000 },
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
    const product = {
      id: "p-new",
      name: validBody.name,
      mode: "slot",
      buyPriceVnd: 50000,
      sellPriceVnd: 150000,
      durationType: "months",
      durationValue: 1,
      isActive: true,
    };
    mockCreateProduct.mockResolvedValue(product);

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
        sellPriceVnd: 150000,
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
      id: "00000000-0000-4000-8000-0000000003ed",
      name: "Updated",
      mode: "key",
      sellPriceVnd: 200000,
    });
    const req = createTestRequest("http://localhost:3000/api/products/00000000-0000-4000-8000-0000000003ed", {
      method: "PUT",
      body: { name: "Updated", mode: "key" },
    });
    const res = await PUT(req, makeParams("00000000-0000-4000-8000-0000000003ed") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.name).toBe("Updated");
  });

  it("should accept partial update (name only)", async () => {
    mockUpdateProduct.mockResolvedValue({
      id: "00000000-0000-4000-8000-0000000003ed",
      name: "New Name",
    });
    const req = createTestRequest("http://localhost:3000/api/products/00000000-0000-4000-8000-0000000003ed", {
      method: "PUT",
      body: { name: "New Name" },
    });
    const res = await PUT(req, makeParams("00000000-0000-4000-8000-0000000003ed") as any);
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
    const req = createTestRequest("http://localhost:3000/api/products/00000000-0000-4000-8000-0000000003ed", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("00000000-0000-4000-8000-0000000003ed") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockDeleteProduct).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000003ed", TEST_ACCOUNT_ID);
  });

  it("should propagate delete errors", async () => {
    mockDeleteProduct.mockRejectedValue(new Error("Product not found"));
    const req = createTestRequest("http://localhost:3000/api/products/00000000-0000-4000-8000-0000000003ed", {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams("00000000-0000-4000-8000-0000000003ed") as any);
    expect(res.status).toBe(500);
  });
});
