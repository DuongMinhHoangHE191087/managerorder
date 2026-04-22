import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockWithAccount, mockWithErrorHandler, createTestRequest, mockRBAC } from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/domains/purchase-orders", () => ({
  listPurchaseOrdersForAccount: vi.fn(),
  createPurchaseOrderForAccount: vi.fn(),
  getPurchaseOrderForAccount: vi.fn(),
  updatePurchaseOrderForAccount: vi.fn(),
  deletePurchaseOrderForAccount: vi.fn(),
}));

import {
  createPurchaseOrderForAccount,
  deletePurchaseOrderForAccount,
  getPurchaseOrderForAccount,
  listPurchaseOrdersForAccount,
  updatePurchaseOrderForAccount,
} from "@/domains/purchase-orders";
import { GET, POST } from "@/app/api/purchase-orders/route";
import {
  DELETE,
  GET as GET_DETAIL,
  PUT,
} from "@/app/api/purchase-orders/[id]/route";

describe("GET /api/purchase-orders", () => {
  beforeEach(() => {
    vi.mocked(listPurchaseOrdersForAccount).mockResolvedValue([
      {
        id: "po-1",
        providerId: "prov-1",
        items: [],
        status: "pending",
        totalAmountVnd: 1000,
        totalPaidVnd: 0,
        createdAt: "2026-04-19T00:00:00.000Z",
        updatedAt: "2026-04-19T00:00:00.000Z",
      } as any,
    ]);
  });

  it("returns mapped purchase orders", async () => {
    const res = await GET(
      createTestRequest("http://localhost/api/purchase-orders?provider_id=prov-1"),
      { params: {} } as any,
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].providerId).toBe("prov-1");
  });
});

describe("POST /api/purchase-orders", () => {
  beforeEach(() => {
    vi.mocked(createPurchaseOrderForAccount).mockResolvedValue({
      id: "po-2",
      providerId: "prov-2",
      items: [],
      status: "pending",
      totalAmountVnd: 1200,
      totalPaidVnd: 0,
      createdAt: "2026-04-19T00:00:00.000Z",
      updatedAt: "2026-04-19T00:00:00.000Z",
    } as any);
  });

  it("creates a purchase order", async () => {
    const res = await POST(
      createTestRequest("http://localhost/api/purchase-orders", {
        method: "POST",
        body: {
          provider_id: "prov-2",
          items: [{ productId: "prod-1", quantity: 1, priceVnd: 1200 }],
          total_amount_vnd: 1200,
          total_paid_vnd: 0,
          payment_method: "bank_transfer",
          notes: "import note",
        },
      }),
      { params: {} } as any,
    );

    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.providerId).toBe("prov-2");
    expect(createPurchaseOrderForAccount).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        provider_id: "prov-2",
        total_amount_vnd: 1200,
      }),
      expect.any(String),
    );
  });

  it("rejects missing provider_id", async () => {
    const res = await POST(
      createTestRequest("http://localhost/api/purchase-orders", {
        method: "POST",
        body: { items: [] },
      }),
      { params: {} } as any,
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing items", async () => {
    const res = await POST(
      createTestRequest("http://localhost/api/purchase-orders", {
        method: "POST",
        body: { provider_id: "prov-2" },
      }),
      { params: {} } as any,
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/purchase-orders/[id]", () => {
  it("returns purchase order detail", async () => {
    vi.mocked(getPurchaseOrderForAccount).mockResolvedValue({
      id: "po-1",
      providerId: "prov-1",
      items: [],
      status: "pending",
      totalAmountVnd: 1000,
      totalPaidVnd: 0,
      createdAt: "2026-04-19T00:00:00.000Z",
      updatedAt: "2026-04-19T00:00:00.000Z",
    } as any);

    const res = await GET_DETAIL(
      createTestRequest("http://localhost/api/purchase-orders/po-1"),
      { params: Promise.resolve({ id: "po-1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("po-1");
  });
});

describe("PUT /api/purchase-orders/[id]", () => {
  it("updates purchase order", async () => {
    vi.mocked(updatePurchaseOrderForAccount).mockResolvedValue({
      id: "po-1",
      providerId: "prov-1",
      items: [],
      status: "received",
      totalAmountVnd: 1200,
      totalPaidVnd: 1200,
      createdAt: "2026-04-19T00:00:00.000Z",
      updatedAt: "2026-04-19T00:00:00.000Z",
    } as any);

    const res = await PUT(
      createTestRequest("http://localhost/api/purchase-orders/po-1", {
        method: "PUT",
        body: {
          total_paid_vnd: 1200,
          status: "received",
        },
      }),
      { params: Promise.resolve({ id: "po-1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("received");
    expect(updatePurchaseOrderForAccount).toHaveBeenCalledWith(
      "po-1",
      expect.any(String),
      expect.objectContaining({
        total_paid_vnd: 1200,
        status: "received",
      }),
      expect.any(String),
    );
  });
});

describe("DELETE /api/purchase-orders/[id]", () => {
  it("deletes purchase order", async () => {
    vi.mocked(deletePurchaseOrderForAccount).mockResolvedValue(undefined as any);

    const res = await DELETE(
      createTestRequest("http://localhost/api/purchase-orders/po-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "po-1" }) } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deletePurchaseOrderForAccount).toHaveBeenCalledWith(
      "po-1",
      expect.any(String),
      expect.any(String),
    );
  });
});
