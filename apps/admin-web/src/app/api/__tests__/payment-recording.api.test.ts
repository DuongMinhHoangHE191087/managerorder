// ============================================================
// API TESTS: Payment Recording — POST /api/orders/[id]/payment
//
// Tests the payment recording endpoint with focus on:
//  - Partial and full payment scenarios
//  - Reconciliation against frozen order totals
//  - Optimistic locking for concurrent payments
//  - Auto status transition (pending_payment → paid)
//  - Overpayment and edge case handling
//
// KEY CONCEPT: The payment route uses optimistic locking via
// `.eq("total_paid", currentPaid)` in the WHERE clause. If another
// payment modified total_paid between read and write → 409 Conflict.
//
// MOCK STRATEGY: We mock supabaseAdmin directly because the payment
// route uses raw Supabase queries (not repo functions).
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

// Mock supabaseAdmin with chainable builder pattern
const _mockSelect = vi.fn();
const _mockUpdate = vi.fn();
const _mockSingle = vi.fn();
const _mockEq = vi.fn();

function resetSupabaseMock() {
  // Create fresh chainable mock for each test
  const chain: Record<string, any> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();
  return chain;
}

let supabaseChain: ReturnType<typeof resetSupabaseMock>;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "from") {
          return (...args: any[]) => {
            supabaseChain.from(...args);
            return supabaseChain;
          };
        }
        return undefined;
      },
    }
  ),
}));

vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/repositories/payments.repo", () => ({
  createPayment: vi.fn().mockResolvedValue({ id: "pay-001" }),
}));
vi.mock("@/lib/supabase/repositories/order-status-history.repo", () => ({
  createOrderStatusHistory: vi.fn().mockResolvedValue(undefined),
}));

import { createPayment } from "@/lib/supabase/repositories/payments.repo";
// import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { resolveUser } from "@/lib/api/rbac";
import { POST } from "@/app/api/orders/[id]/payment/route";

// ── Fixtures ─────────────────────────────────────────────────
const ORDER_ID = "ord-pay-001";

function makeFetchResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: ORDER_ID,
      status: "pending_payment",
      total_amount_vnd: 200000,
      total_paid: 0,
      unit_price_vnd: 100000,
      product_name_snapshot: "Netflix 1 tháng",
      quantity: 2,
      customer_id: "cust-001",
      ...overrides,
    },
    error: null,
  };
}

function makeUpdateResult(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: ORDER_ID,
      status: "pending_payment",
      total_amount_vnd: 200000,
      total_paid: 0,
      ...overrides,
    },
    error: null,
  };
}

// ── Helpers ──────────────────────────────────────────────────
function postPayment(id: string, body: unknown) {
  return POST(
    createTestRequest(`http://localhost/api/orders/${id}/payment`, {
      method: "POST",
      body,
    }),
    { params: Promise.resolve({ id }) } as any
  );
}

/**
 * Setup supabase mock for a standard payment flow:
 * 1st chain call → fetch order (SELECT)
 * 2nd chain call → update order (UPDATE)
 */
function setupPaymentFlow(
  fetchResult: ReturnType<typeof makeFetchResult>,
  updateResult: ReturnType<typeof makeUpdateResult>
) {
  let callCount = 0;
  supabaseChain = resetSupabaseMock();

  // Each call to .single() alternates between fetch and update results
  supabaseChain.single.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve(fetchResult);
    return Promise.resolve(updateResult);
  });
}

// ── Tests ────────────────────────────────────────────────────

describe("POST /api/orders/[id]/payment — Payment Recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseChain = resetSupabaseMock();
    vi.mocked(resolveUser).mockResolvedValue({
      userId: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      role: "admin_owner",
      accountId: TEST_ACCOUNT_ID,
      displayName: "Test Admin",
    } as any);
  });

  // ─── Validation ──────────────────────────────────────────

  describe("Input validation", () => {
    it("rejects amount=0 → 400", async () => {
      setupPaymentFlow(makeFetchResult(), makeUpdateResult());
      const res = await postPayment(ORDER_ID, { amount: 0 });
      expect(res.status).toBe(400);
    });

    it("rejects negative amount → 400", async () => {
      setupPaymentFlow(makeFetchResult(), makeUpdateResult());
      const res = await postPayment(ORDER_ID, { amount: -50000 });
      expect(res.status).toBe(400);
    });

    it("rejects missing amount → 400", async () => {
      setupPaymentFlow(makeFetchResult(), makeUpdateResult());
      const res = await postPayment(ORDER_ID, {});
      expect(res.status).toBe(400);
    });

    it("rejects invalid payment terms → 400", async () => {
      const res = await postPayment(ORDER_ID, {
        amount: 50000,
        payment_terms: "wire_transfer",
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── Partial Payment ────────────────────────────────────

  describe("Partial payment", () => {
    it("records partial payment (50k/200k) → 200, remaining=150k", async () => {
      setupPaymentFlow(
        makeFetchResult({ total_paid: 0, total_amount_vnd: 200000 }),
        makeUpdateResult({ total_paid: 50000, status: "pending_payment" })
      );

      const res = await postPayment(ORDER_ID, { amount: 50000 });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.payment.new_total_paid).toBe(50000);
      expect(body.payment.remaining).toBe(150000);
      expect(body.payment.fully_paid).toBe(false);
    });

    it("records second partial payment (100k after 50k already paid)", async () => {
      setupPaymentFlow(
        makeFetchResult({ total_paid: 50000, total_amount_vnd: 200000 }),
        makeUpdateResult({ total_paid: 150000, status: "pending_payment" })
      );

      const res = await postPayment(ORDER_ID, { amount: 100000 });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.payment.new_total_paid).toBe(150000);
      expect(body.payment.remaining).toBe(50000);
      expect(body.payment.fully_paid).toBe(false);
    });
  });

  // ─── Full Payment ────────────────────────────────────────

  describe("Full payment", () => {
    it("records full payment → auto-transitions to paid", async () => {
      setupPaymentFlow(
        makeFetchResult({
          total_paid: 0,
          total_amount_vnd: 200000,
          status: "pending_payment",
        }),
        makeUpdateResult({ total_paid: 200000, status: "paid" })
      );

      const res = await postPayment(ORDER_ID, { amount: 200000 });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.payment.fully_paid).toBe(true);
      expect(body.payment.remaining).toBe(0);
    });

    it("final partial payment completes the total → fully_paid=true", async () => {
      setupPaymentFlow(
        makeFetchResult({
          total_paid: 150000,
          total_amount_vnd: 200000,
          status: "pending_payment",
        }),
        makeUpdateResult({ total_paid: 200000, status: "paid" })
      );

      const res = await postPayment(ORDER_ID, { amount: 50000 });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.payment.fully_paid).toBe(true);
      expect(body.payment.new_total_paid).toBe(200000);
    });

    it("creates payment record via createPayment()", async () => {
      setupPaymentFlow(
        makeFetchResult({ total_paid: 0, total_amount_vnd: 100000 }),
        makeUpdateResult({ total_paid: 100000, status: "paid" })
      );

      await postPayment(ORDER_ID, {
        amount: 100000,
        payment_method: "bank_transfer",
        note: "Full payment",
      });

      expect(createPayment).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({
          order_id: ORDER_ID,
          amount: 100000,
          payment_method: "bank_transfer",
          note: "Full payment",
        })
      );
    });

    it("persists order-level payment terms and source when provided", async () => {
      setupPaymentFlow(
        makeFetchResult({ total_paid: 0, total_amount_vnd: 100000 }),
        makeUpdateResult({
          total_paid: 50000,
          status: "pending_payment",
          payment_terms: "credit",
          payment_method: "debt",
          payment_source_id: "ps-001",
        })
      );

      await postPayment(ORDER_ID, {
        amount: 50000,
        payment_terms: "credit",
        payment_source_id: "ps-001",
        note: "Dot 2",
      });

      expect(supabaseChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          total_paid: 50000,
          payment_terms: "credit",
          payment_method: "debt",
          payment_source_id: "ps-001",
        })
      );
      expect(createPayment).toHaveBeenCalledWith(
        TEST_ACCOUNT_ID,
        expect.objectContaining({
          payment_method: "debt",
          payment_source_id: "ps-001",
          note: "Dot 2",
        })
      );
    });

    it("logs status history when auto-transitioning to paid", async () => {
      setupPaymentFlow(
        makeFetchResult({
          total_paid: 0,
          total_amount_vnd: 100000,
          status: "pending_payment",
        }),
        makeUpdateResult({ total_paid: 100000, status: "paid" })
      );

      await postPayment(ORDER_ID, { amount: 100000 });

      expect(createOrderStatusHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: ORDER_ID,
          old_status: "pending_payment",
          new_status: "paid",
        })
      );
    });
  });

  // ─── Overpayment Protection ──────────────────────────────

  describe("Overpayment protection", () => {
    it("rejects payment exceeding remaining → 422", async () => {
      setupPaymentFlow(
        makeFetchResult({ total_paid: 150000, total_amount_vnd: 200000 }),
        makeUpdateResult()
      );

      const res = await postPayment(ORDER_ID, { amount: 100000 });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.message).toContain("vượt quá");
      expect(body.error.details.remaining).toBe(50000);
      expect(body.error.details.attempted).toBe(100000);
    });

    it("rejects payment when already fully paid → 409", async () => {
      setupPaymentFlow(
        makeFetchResult({ total_paid: 200000, total_amount_vnd: 200000 }),
        makeUpdateResult()
      );

      const res = await postPayment(ORDER_ID, { amount: 10000 });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.message).toContain("đầy đủ");
    });
  });

  // ─── Optimistic Locking (Concurrent Payment) ────────────
  //
  // STRATEGY: The route uses `.eq("total_paid", currentPaid)` as
  // an optimistic lock. If another payment changed total_paid
  // between the SELECT and UPDATE, the UPDATE returns no rows → 409.
  //
  // We simulate this by making the update return { data: null, error: ... }

  describe("Optimistic locking — concurrent payment race condition", () => {
    it("returns 409 when concurrent payment modified total_paid", async () => {
      let callCount = 0;
      supabaseChain = resetSupabaseMock();
      supabaseChain.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // SELECT succeeds — order has 0 paid
          return Promise.resolve(
            makeFetchResult({ total_paid: 0, total_amount_vnd: 200000 })
          );
        }
        // UPDATE fails — another payment already changed total_paid
        // The .eq("total_paid", 0) doesn't match any row because
        // total_paid was updated to 100000 by a concurrent request
        return Promise.resolve({
          data: null,
          error: { code: "PGRST116", message: "No rows found" },
        });
      });

      const res = await postPayment(ORDER_ID, { amount: 100000 });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.message).toContain("xung đột");
    });
  });

  // ─── Order Status Guards ─────────────────────────────────

  describe("Order status guards", () => {
    it("rejects payment for refunded order → 409", async () => {
      setupPaymentFlow(
        makeFetchResult({ status: "refunded", total_paid: 200000 }),
        makeUpdateResult()
      );

      const res = await postPayment(ORDER_ID, { amount: 50000 });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error.message).toContain("hoàn tiền");
    });

    it("rejects payment for non-existent order → 404", async () => {
      supabaseChain = resetSupabaseMock();
      supabaseChain.single.mockResolvedValue({ data: null, error: { message: "Not found" } });

      const res = await postPayment("non-existent", { amount: 50000 });
      expect(res.status).toBe(404);
    });
  });

  // ─── Frozen Total Invariant ──────────────────────────────
  // Reconciliation uses total_amount_vnd (frozen at creation),
  // never recalculated from live product prices.

  describe("Frozen total invariant", () => {
    it("reconciles against frozen total, not live prices", async () => {
      // Order was created with total_amount_vnd=200000 (frozen)
      // Even if product price changed to 250000 since then,
      // the payment is reconciled against the original 200000
      setupPaymentFlow(
        makeFetchResult({ total_paid: 0, total_amount_vnd: 200000 }),
        makeUpdateResult({ total_paid: 200000, status: "paid" })
      );

      const res = await postPayment(ORDER_ID, { amount: 200000 });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.payment.order_total).toBe(200000);
      expect(body.payment.fully_paid).toBe(true);
    });

    it("returns order snapshot data in payment response", async () => {
      setupPaymentFlow(
        makeFetchResult({
          total_paid: 0,
          total_amount_vnd: 200000,
          unit_price_vnd: 100000,
          product_name_snapshot: "Netflix 1 tháng",
          quantity: 2,
        }),
        makeUpdateResult({ total_paid: 200000, status: "paid" })
      );

      const res = await postPayment(ORDER_ID, { amount: 200000 });
      const body = await res.json();
      expect(body.payment.order_unit_price).toBe(100000);
      expect(body.payment.order_product_name).toBe("Netflix 1 tháng");
      expect(body.payment.order_quantity).toBe(2);
    });
  });

  // ─── Data-Driven: VND Amounts ────────────────────────────

  describe.each([
    { total: 100000, paid: 0, amount: 100000, expectedRemaining: 0, fullyPaid: true },
    { total: 150000, paid: 50000, amount: 50000, expectedRemaining: 50000, fullyPaid: false },
    { total: 350000, paid: 200000, amount: 150000, expectedRemaining: 0, fullyPaid: true },
    { total: 99000, paid: 0, amount: 33000, expectedRemaining: 66000, fullyPaid: false },
    { total: 1000000, paid: 999999, amount: 1, expectedRemaining: 0, fullyPaid: true },
  ])(
    "VND amount: total=$total, paid=$paid, amount=$amount",
    ({ total, paid, amount, expectedRemaining, fullyPaid }) => {
      it(`→ remaining=${expectedRemaining}, fullyPaid=${fullyPaid}`, async () => {
        const newPaid = paid + amount;
        setupPaymentFlow(
          makeFetchResult({ total_paid: paid, total_amount_vnd: total }),
          makeUpdateResult({
            total_paid: newPaid,
            status: fullyPaid ? "paid" : "pending_payment",
          })
        );

        const res = await postPayment(ORDER_ID, { amount });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.payment.remaining).toBe(expectedRemaining);
        expect(body.payment.fully_paid).toBe(fullyPaid);
      });
    }
  );
});
