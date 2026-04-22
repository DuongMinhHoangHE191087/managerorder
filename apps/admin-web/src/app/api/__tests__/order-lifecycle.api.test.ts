// ============================================================
// API TESTS: Order Lifecycle — PUT /api/orders/[id]
//
// Tests the full order status transition lifecycle:
//  - Valid transitions through the state machine
//  - Invalid transitions → 422
//  - Auto-deallocation on specific status changes
//  - Side effects: activity log + order status history
//  - Edge cases: empty body, non-existent order
//
// Strategy: Mock repos, state machine, and allocation service.
// The route reads current order, validates the transition via
// canTransitionOrder(), optionally deallocates, then persists.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockWithAccount,
  mockWithErrorHandler,
  mockResolveUser,
  createTestRequest,
  TEST_ACCOUNT_ID,
  TEST_USER_EMAIL,
  TEST_USER_ID,
} from "./helpers/setup";

// ── Mocks ────────────────────────────────────────────────────
vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockResolveUser());
vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  getOrderWithItems: vi.fn(),
  updateOrderPaymentAndStatus: vi.fn(),
  deleteOrder: vi.fn(),
}));
vi.mock("@/lib/domain/order-state-machine", () => ({
  canTransitionOrder: vi.fn(),
}));
vi.mock("@/lib/services/allocation.service", () => ({
  deallocateOrder: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/repositories/order-status-history.repo", () => ({
  createOrderStatusHistory: vi.fn().mockResolvedValue(undefined),
}));

import {
  getOrderWithItems,
  updateOrderPaymentAndStatus,
  deleteOrder,
} from "@/lib/supabase/repositories/orders.repo";
import { canTransitionOrder } from "@/lib/domain/order-state-machine";
import { deallocateOrder } from "@/lib/services/allocation.service";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { resolveUser } from "@/lib/api/rbac";
import { GET, PUT, DELETE } from "@/app/api/orders/[id]/route";

// ── Fixtures ─────────────────────────────────────────────────
const ORDER_ID = "ord-lifecycle-001";

function makeMockOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    account_id: TEST_ACCOUNT_ID,
    customer_id: "cust-001",
    status: "pending_payment",
    total_amount_vnd: 200000,
    total_paid: 0,
    ...overrides,
  };
}

// ── Helpers ──────────────────────────────────────────────────
function putOrder(id: string, body: unknown) {
  return PUT(
    createTestRequest(`http://localhost/api/orders/${id}`, {
      method: "PUT",
      body,
    }),
    { params: Promise.resolve({ id }) } as any
  );
}

function getOrder(id: string) {
  return GET(
    createTestRequest(`http://localhost/api/orders/${id}`),
    { params: Promise.resolve({ id }) } as any
  );
}

function deleteOrderReq(id: string) {
  return DELETE(
    createTestRequest(`http://localhost/api/orders/${id}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) } as any
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("GET /api/orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns order with items → 200", async () => {
    const order = makeMockOrder({ items: [{ id: "item-1" }] });
    vi.mocked(getOrderWithItems).mockResolvedValue(order as any);

    const res = await getOrder(ORDER_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(ORDER_ID);
  });

  it("returns 404 for non-existent order", async () => {
    vi.mocked(getOrderWithItems).mockResolvedValue(null as any);

    const res = await getOrder("non-existent");
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/orders/[id] — Status Transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUser).mockResolvedValue({
      userId: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      role: "admin_owner",
      accountId: TEST_ACCOUNT_ID,
      displayName: "Test Admin",
    } as any);
    vi.mocked(canTransitionOrder).mockReturnValue(true);
  });

  // ─── Valid Transitions ───────────────────────────────────

  describe("Valid transitions", () => {
    const validTransitions = [
      { from: "pending_payment", to: "paid", label: "pending_payment → paid" },
      { from: "paid", to: "provisioning", label: "paid → provisioning" },
      { from: "provisioning", to: "active", label: "provisioning → active" },
      { from: "active", to: "expired", label: "active → expired" },
      { from: "pending_payment", to: "refunded", label: "pending_payment → refunded" },
    ];

    it.each(validTransitions)(
      "$label → 200",
      async ({ from, to }) => {
        const order = makeMockOrder({ status: from });
        vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
        vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue({
          ...order,
          status: to,
        } as any);

        const res = await putOrder(ORDER_ID, { status: to });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.status).toBe(to);
      }
    );

    it("logs activity and status history on transition", async () => {
      const order = makeMockOrder({ status: "pending_payment" });
      vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
      vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue({
        ...order,
        status: "paid",
        customer_id: "cust-001",
      } as any);

      await putOrder(ORDER_ID, { status: "paid" });

      expect(createOrderStatusHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: ORDER_ID,
          old_status: "pending_payment",
          new_status: "paid",
        })
      );
      expect(createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          account_id: TEST_ACCOUNT_ID,
          action_type: "ORDER_UPDATED",
          order_id: ORDER_ID,
        })
      );
    });
  });

  // ─── Invalid Transitions ─────────────────────────────────

  describe("Invalid transitions → 422", () => {
    const invalidTransitions = [
      { from: "delivered", to: "pending_payment", label: "delivered → pending_payment" },
      { from: "expired", to: "paid", label: "expired → paid" },
      { from: "refunded", to: "active", label: "refunded → active" },
    ];

    it.each(invalidTransitions)(
      "$label → 422",
      async ({ from, to }) => {
        const order = makeMockOrder({ status: from });
        vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
        vi.mocked(canTransitionOrder).mockReturnValue(false);

        const res = await putOrder(ORDER_ID, { status: to });
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.error).toContain("Không thể chuyển");
      }
    );
  });

  // ─── Auto-deallocation ───────────────────────────────────

  describe("Auto-deallocation", () => {
    it("deallocates when moving from provisioning → refunded", async () => {
      const order = makeMockOrder({ status: "provisioning" });
      vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
      vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue({
        ...order,
        status: "refunded",
      } as any);

      await putOrder(ORDER_ID, { status: "refunded" });

      expect(deallocateOrder).toHaveBeenCalledWith(ORDER_ID, TEST_ACCOUNT_ID);
    });

    it("deallocates when moving from active → refunded", async () => {
      const order = makeMockOrder({ status: "active" });
      vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
      vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue({
        ...order,
        status: "refunded",
      } as any);

      await putOrder(ORDER_ID, { status: "refunded" });

      expect(deallocateOrder).toHaveBeenCalledWith(ORDER_ID, TEST_ACCOUNT_ID);
    });

    it("does NOT deallocate for paid → provisioning (forward move)", async () => {
      const order = makeMockOrder({ status: "paid" });
      vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
      vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue({
        ...order,
        status: "provisioning",
      } as any);

      await putOrder(ORDER_ID, { status: "provisioning" });

      expect(deallocateOrder).not.toHaveBeenCalled();
    });

    it("does NOT deallocate for pending_payment → paid (no allocation yet)", async () => {
      const order = makeMockOrder({ status: "pending_payment" });
      vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
      vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue({
        ...order,
        status: "paid",
      } as any);

      await putOrder(ORDER_ID, { status: "paid" });

      expect(deallocateOrder).not.toHaveBeenCalled();
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────

  describe("Edge cases", () => {
    it("returns 400 for empty body", async () => {
      const res = await putOrder(ORDER_ID, {});
      expect(res.status).toBe(400);
    });

    it("updates payment fields without status change", async () => {
      const order = makeMockOrder({ status: "pending_payment" });
      vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
      vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue({
        ...order,
        total_paid: 50000,
        payment_method: "bank_transfer",
      } as any);

      const res = await putOrder(ORDER_ID, {
        total_paid: 50000,
        payment_method: "bank_transfer",
      });
      expect(res.status).toBe(200);
      // No status history should be logged since status didn't change
      expect(createOrderStatusHistory).not.toHaveBeenCalled();
    });

    it("updates sales_note without changing status", async () => {
      const order = makeMockOrder({ status: "paid" });
      vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
      vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue({
        ...order,
        sales_note: "Updated note",
      } as any);

      const res = await putOrder(ORDER_ID, {
        sales_note: "Updated note",
      });
      expect(res.status).toBe(200);
    });

    it("same status (no transition) does not trigger history", async () => {
      const order = makeMockOrder({ status: "paid" });
      vi.mocked(getOrderWithItems).mockResolvedValue(order as any);
      vi.mocked(updateOrderPaymentAndStatus).mockResolvedValue(order as any);

      await putOrder(ORDER_ID, { status: "paid" });

      // Same status → no history should be logged
      expect(createOrderStatusHistory).not.toHaveBeenCalled();
    });
  });
});

describe("DELETE /api/orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deallocates and deletes order → 200", async () => {
    vi.mocked(deallocateOrder).mockResolvedValue(undefined as any);
    vi.mocked(deleteOrder).mockResolvedValue(undefined as any);

    const res = await deleteOrderReq(ORDER_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("calls deallocateOrder before deleteOrder", async () => {
    const callOrder: string[] = [];
    vi.mocked(deallocateOrder).mockImplementation(async () => {
      callOrder.push("deallocate");
      return undefined as any;
    });
    vi.mocked(deleteOrder).mockImplementation(async () => {
      callOrder.push("delete");
      return undefined as any;
    });

    await deleteOrderReq(ORDER_ID);

    expect(callOrder).toEqual(["deallocate", "delete"]);
  });
});
