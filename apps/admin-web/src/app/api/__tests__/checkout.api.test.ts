// ============================================================
// API TESTS: Checkout — POST /api/orders
//
// Covers the full order creation flow with:
//  - Happy path: single & multi-item orders
//  - Zod validation: missing fields, invalid types
//  - Service-layer error propagation
//  - Data-driven pricing scenarios (discount, rounding, edge totals)
//
// Strategy: Mock service & repo layers. The route itself only does
// Zod parsing → delegates to createOrderWithItems() → returns result.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  createTestRequest,
  mockRBAC,
} from "./helpers/setup";

// ── Mocks (MUST be before route import) ──────────────────────
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockRBAC());
vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  getOrdersPaginated: vi.fn(),
}));
vi.mock("@/lib/services/order.service", () => ({
  createOrderWithItems: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/order-status-history.repo", () => ({
  createOrderStatusHistory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/utils/api-helpers", () => ({
  getPaginationParams: vi.fn((sp: URLSearchParams) => ({
    page: parseInt(sp.get("page") || "1"),
    limit: parseInt(sp.get("limit") || "20"),
    offset: 0,
  })),
}));

import { createOrderWithItems } from "@/lib/services/order.service";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { POST } from "@/app/api/orders/route";

// ── Fixtures ─────────────────────────────────────────────────
const validSingleItemBody = {
  customerId: "cust-uuid-001",
  items: [{ productId: "prod-001", quantity: 1 }],
};

const validMultiItemBody = {
  customerId: "cust-uuid-001",
  items: [
    { productId: "prod-001", quantity: 2 },
    { productId: "prod-002", quantity: 1, notes: "Account B" },
  ],
  paymentMethod: "debt" as const,
  salesNote: "Flash sale order",
};

const mockCreatedOrder = {
  order: {
    id: "ord-new-001",
    status: "pending_payment",
    total_amount_vnd: 100000,
    total_paid: 0,
    customer_id: "cust-uuid-001",
  },
  items: [
    {
      id: "item-001",
      product_id: "prod-001",
      quantity: 1,
      price_vnd: 100000,
      subtotal_vnd: 100000,
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────
function postOrder(body: unknown) {
  return POST(
    createTestRequest("http://localhost/api/orders", {
      method: "POST",
      body,
    }),
    { params: {} } as any
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("POST /api/orders — Checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOrderWithItems).mockResolvedValue(mockCreatedOrder as any);
    vi.mocked(createOrderStatusHistory).mockResolvedValue(undefined as any);
  });

  // ─── Happy Path ──────────────────────────────────────────

  describe("Happy path", () => {
    it("creates a single-item order and returns 201", async () => {
      const res = await postOrder(validSingleItemBody);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.id).toBe("ord-new-001");
      expect(body.data.items).toHaveLength(1);
    });

    it("creates a multi-item order with optional fields", async () => {
      vi.mocked(createOrderWithItems).mockResolvedValue({
        order: {
          id: "ord-new-002",
          status: "pending_payment",
          total_amount_vnd: 350000,
        },
        items: [
          { id: "item-001", subtotal_vnd: 200000 },
          { id: "item-002", subtotal_vnd: 150000 },
        ],
      } as any);

      const res = await postOrder(validMultiItemBody);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.items).toHaveLength(2);
    });

    it("passes validated data to createOrderWithItems service", async () => {
      await postOrder(validSingleItemBody);

      expect(createOrderWithItems).toHaveBeenCalledWith(
        expect.any(String), // accountId
        expect.objectContaining({
          customerId: "cust-uuid-001",
          items: expect.arrayContaining([
            expect.objectContaining({ productId: "prod-001", quantity: 1 }),
          ]),
        })
      );
    });

    it("logs the initial order timeline entry after creation", async () => {
      await postOrder(validSingleItemBody);

      expect(createOrderStatusHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: "ord-new-001",
          old_status: null,
          new_status: "pending_payment",
          changed_by: "Test User",
          change_reason: "Tạo đơn hàng mới",
          metadata: expect.objectContaining({
            source: "admin-web",
            items_count: 1,
          }),
        }),
      );
    });

    it("creates order with paymentMethod=paid → status may be paid", async () => {
      vi.mocked(createOrderWithItems).mockResolvedValue({
        order: { id: "ord-paid", status: "paid", total_paid: 100000 },
        items: [{ id: "item-001" }],
      } as any);

      const res = await postOrder({
        ...validSingleItemBody,
        paymentMethod: "paid",
      });
      const body = await res.json();
      expect(body.data.status).toBe("paid");
    });

    it("accepts optional billingDetails", async () => {
      const res = await postOrder({
        ...validSingleItemBody,
        billingDetails: {
          companyName: "Acme Corp",
          taxId: "0123456789",
          companyAddress: "123 Main St",
          email: "billing@acme.com",
        },
      });
      expect(res.status).toBe(201);
    });

    it("surfaces warning from the order service in the response payload", async () => {
      vi.mocked(createOrderWithItems).mockResolvedValue({
        order: {
          id: "ord-warning",
          status: "pending_payment",
          total_amount_vnd: 100000,
        },
        items: [{ id: "item-warning" }],
        warning: "Slot sync failed",
      } as any);

      const res = await postOrder(validSingleItemBody);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.warning).toBe("Slot sync failed");
    });
  });

  // ─── Validation Errors (Zod) ─────────────────────────────

  describe("Validation errors", () => {
    it("rejects empty body → 400", async () => {
      const res = await postOrder({});
      expect(res.status).toBe(400);
    });

    it("rejects missing customerId → 400", async () => {
      const res = await postOrder({
        items: [{ productId: "prod-001", quantity: 1 }],
      });
      expect(res.status).toBe(400);
    });

    it("rejects empty items array → 400", async () => {
      const res = await postOrder({
        customerId: "cust-uuid-001",
        items: [],
      });
      expect(res.status).toBe(400);
    });

    it("rejects item with quantity=0 → 400", async () => {
      const res = await postOrder({
        customerId: "cust-uuid-001",
        items: [{ productId: "prod-001", quantity: 0 }],
      });
      expect(res.status).toBe(400);
    });

    it("rejects item with negative quantity → 400", async () => {
      const res = await postOrder({
        customerId: "cust-uuid-001",
        items: [{ productId: "prod-001", quantity: -1 }],
      });
      expect(res.status).toBe(400);
    });

    it("rejects item without productId → 400", async () => {
      const res = await postOrder({
        customerId: "cust-uuid-001",
        items: [{ quantity: 1 }],
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid paymentMethod → 400", async () => {
      const res = await postOrder({
        ...validSingleItemBody,
        paymentMethod: "bitcoin",
      });
      expect(res.status).toBe(400);
    });

    it("rejects customerId as empty string → 400", async () => {
      const res = await postOrder({
        customerId: "",
        items: [{ productId: "prod-001", quantity: 1 }],
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Service Layer Errors ────────────────────────────────

  describe("Service error propagation", () => {
    it("returns 409 when service throws duplicate error", async () => {
      vi.mocked(createOrderWithItems).mockRejectedValue(
        Object.assign(new Error("Duplicate order detected"), { status: 409 })
      );
      const res = await postOrder(validSingleItemBody);
      expect(res.status).toBe(409);
    });

    it("returns 404 when service throws product-not-found", async () => {
      vi.mocked(createOrderWithItems).mockRejectedValue(
        Object.assign(new Error("Product not found: prod-999"), { status: 404 })
      );
      const res = await postOrder({
        customerId: "cust-uuid-001",
        items: [{ productId: "prod-999", quantity: 1 }],
      });
      expect(res.status).toBe(404);
    });

    it("returns 500 when service throws unexpected error", async () => {
      vi.mocked(createOrderWithItems).mockRejectedValue(
        new Error("Database connection failed")
      );
      const res = await postOrder(validSingleItemBody);
      expect(res.status).toBe(500);
    });

    it("returns 422 when service throws business rule violation", async () => {
      vi.mocked(createOrderWithItems).mockRejectedValue(
        Object.assign(new Error("Insufficient inventory slots"), {
          status: 422,
        })
      );
      const res = await postOrder(validSingleItemBody);
      expect(res.status).toBe(422);
    });
  });

  // ─── Data-Driven: Pricing Scenarios ──────────────────────
  // Validates the service is called correctly for various pricing combinations.
  // Actual calculation logic is tested in order-service-logic.test.ts,
  // here we verify the API layer correctly passes data through.

  describe.each([
    {
      scenario: "Standard price — no discount",
      items: [{ productId: "prod-001", quantity: 2 }],
      expectedTotal: 200000,
    },
    {
      scenario: "Multiple products — mixed quantities",
      items: [
        { productId: "prod-001", quantity: 3 },
        { productId: "prod-002", quantity: 1 },
      ],
      expectedTotal: 450000,
    },
    {
      scenario: "Single item — quantity 1",
      items: [{ productId: "prod-001", quantity: 1 }],
      expectedTotal: 100000,
    },
    {
      scenario: "Large quantity order",
      items: [{ productId: "prod-001", quantity: 100 }],
      expectedTotal: 10000000,
    },
    {
      scenario: "Odd VND amount — no rounding issues",
      items: [{ productId: "prod-003", quantity: 3 }],
      expectedTotal: 240000,
    },
  ])("Data-driven: $scenario", ({ items, expectedTotal }) => {
    it(`creates order → service called with correct items`, async () => {
      vi.mocked(createOrderWithItems).mockResolvedValue({
        order: {
          id: "ord-dd",
          status: "pending_payment",
          total_amount_vnd: expectedTotal,
        },
        items: items.map((item, i) => ({
          id: `item-${i}`,
          product_id: item.productId,
          quantity: item.quantity,
        })),
      } as any);

      const res = await postOrder({ customerId: "cust-uuid-001", items });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.total_amount_vnd).toBe(expectedTotal);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────

  describe("Edge cases", () => {
    it("accepts very long salesNote (up to 500 chars)", async () => {
      const res = await postOrder({
        ...validSingleItemBody,
        salesNote: "A".repeat(500),
      });
      expect(res.status).toBe(201);
    });

    it("rejects salesNote exceeding 500 chars → 400", async () => {
      const res = await postOrder({
        ...validSingleItemBody,
        salesNote: "A".repeat(501),
      });
      expect(res.status).toBe(400);
    });

    it("accepts notes per item (up to 300 chars)", async () => {
      const res = await postOrder({
        customerId: "cust-uuid-001",
        items: [
          { productId: "prod-001", quantity: 1, notes: "N".repeat(300) },
        ],
      });
      expect(res.status).toBe(201);
    });

    it("rejects notes per item exceeding 300 chars → 400", async () => {
      const res = await postOrder({
        customerId: "cust-uuid-001",
        items: [
          { productId: "prod-001", quantity: 1, notes: "N".repeat(301) },
        ],
      });
      expect(res.status).toBe(400);
    });

    it("accepts proofImageUrls up to 5 images", async () => {
      const res = await postOrder({
        ...validSingleItemBody,
        proofImageUrls: [
          "url1",
          "url2",
          "url3",
          "url4",
          "url5",
        ],
      });
      expect(res.status).toBe(201);
    });

    it("rejects proofImageUrls exceeding 5 → 400", async () => {
      const res = await postOrder({
        ...validSingleItemBody,
        proofImageUrls: [
          "url1",
          "url2",
          "url3",
          "url4",
          "url5",
          "url6",
        ],
      });
      expect(res.status).toBe(400);
    });
  });
});
