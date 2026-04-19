// ============================================================
// API TESTS: Refund — POST & GET /api/orders/[id]/refunds
//
// Tests refund request creation with:
//  - Pro-rata refund calculation (consumed days / total days)
//  - Full refund mode
//  - Guards: already refunded, no payment to refund
//  - Data-driven: edge cases for consumed ratios
//
// The refund route calculates refundable amount using
// calculateRefund() from refund-policy.ts, then persists via
// createRefundRequest() repo.
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

// Mock supabaseAdmin for order verification queries
const supabaseSingleMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: supabaseSingleMock,
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/supabase/repositories/refund-requests.repo", () => ({
  createRefundRequest: vi.fn(),
  getRefundsByOrder: vi.fn(),
}));
vi.mock("@/lib/domain/refund-policy", () => ({
  calculateRefund: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  createRefundRequest,
  getRefundsByOrder,
} from "@/lib/supabase/repositories/refund-requests.repo";
import { calculateRefund } from "@/lib/domain/refund-policy";
import { resolveUser } from "@/lib/api/rbac";
import { GET, POST } from "@/app/api/orders/[id]/refunds/route";

// ── Fixtures ─────────────────────────────────────────────────
const ORDER_ID = "ord-refund-001";

function mockOrderQuery(overrides: Record<string, unknown> = {}) {
  supabaseSingleMock.mockResolvedValue({
    data: {
      id: ORDER_ID,
      status: "paid",
      total_amount_vnd: 200000,
      total_paid: 200000,
      customer_id: "cust-001",
      ...overrides,
    },
    error: null,
  });
}

// ── Helpers ──────────────────────────────────────────────────
function postRefund(id: string, body: unknown) {
  return POST(
    createTestRequest(`http://localhost/api/orders/${id}/refunds`, {
      method: "POST",
      body,
    }),
    { params: Promise.resolve({ id }) } as any
  );
}

function getRefunds(id: string) {
  return GET(
    createTestRequest(`http://localhost/api/orders/${id}/refunds`),
    { params: Promise.resolve({ id }) } as any
  );
}

// ── Tests ────────────────────────────────────────────────────

describe("GET /api/orders/[id]/refunds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns list of refunds → 200", async () => {
    supabaseSingleMock.mockResolvedValue({
      data: { id: ORDER_ID },
      error: null,
    });
    vi.mocked(getRefundsByOrder).mockResolvedValue([
      { id: "ref-001", refundable_amount_vnd: 100000, refund_mode: "pro_rata" },
    ] as any);

    const res = await getRefunds(ORDER_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("returns 404 for non-existent order", async () => {
    supabaseSingleMock.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const res = await getRefunds("non-existent");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/orders/[id]/refunds — Refund Creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUser).mockResolvedValue({
      userId: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      role: "admin_owner",
      accountId: TEST_ACCOUNT_ID,
      displayName: "Test Admin",
    } as any);
    vi.mocked(createRefundRequest).mockResolvedValue({
      id: "ref-new-001",
      refundable_amount_vnd: 133333,
    } as any);
  });

  // ─── Pro-Rata Refund ─────────────────────────────────────

  describe("Pro-rata refund", () => {
    it("creates refund with calculated pro-rata amount → 201", async () => {
      mockOrderQuery({ total_paid: 200000 });
      vi.mocked(calculateRefund).mockReturnValue({
        refundableAmountVnd: 133333,
        consumedRatio: 0.3333,
        notes: "Pro-rata refund",
      });

      const res = await postRefund(ORDER_ID, {
        refund_mode: "pro_rata",
        consumed_days: 10,
        total_days: 30,
        reason: "Customer request",
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.id).toBe("ref-new-001");
    });

    it("calls calculateRefund with correct params", async () => {
      mockOrderQuery({ total_paid: 150000 });
      vi.mocked(calculateRefund).mockReturnValue({
        refundableAmountVnd: 100000,
        consumedRatio: 0.3333,
        notes: "Pro-rata",
      });

      await postRefund(ORDER_ID, {
        refund_mode: "pro_rata",
        consumed_days: 10,
        total_days: 30,
      });

      expect(calculateRefund).toHaveBeenCalledWith({
        paidAmountVnd: 150000,
        consumedDays: 10,
        totalDays: 30,
        mode: "pro_rata",
      });
    });

    it("passes refund data to createRefundRequest", async () => {
      mockOrderQuery({ total_paid: 200000, customer_id: "cust-002" });
      vi.mocked(calculateRefund).mockReturnValue({
        refundableAmountVnd: 66666,
        consumedRatio: 0.6667,
        notes: "Pro-rata",
      });

      await postRefund(ORDER_ID, {
        refund_mode: "pro_rata",
        consumed_days: 20,
        total_days: 30,
        reason: "Expired unused",
      });

      expect(createRefundRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: ORDER_ID,
          customer_id: "cust-002",
          paid_amount_vnd: 200000,
          consumed_days: 20,
          total_days: 30,
          refund_mode: "pro_rata",
          refundable_amount_vnd: 66666,
          reason: "Expired unused",
        })
      );
    });
  });

  // ─── Full Refund ─────────────────────────────────────────

  describe("Full refund", () => {
    it("creates full refund → 201", async () => {
      mockOrderQuery({ total_paid: 200000 });
      vi.mocked(calculateRefund).mockReturnValue({
        refundableAmountVnd: 200000,
        consumedRatio: 0,
        notes: "Full refund",
      });

      const res = await postRefund(ORDER_ID, {
        refund_mode: "full",
        reason: "Service issue",
      });

      expect(res.status).toBe(201);
    });
  });

  // ─── Guards ──────────────────────────────────────────────

  describe("Refund guards", () => {
    it("rejects refund for already refunded order → 409", async () => {
      mockOrderQuery({ status: "refunded", total_paid: 200000 });

      const res = await postRefund(ORDER_ID, { refund_mode: "full" });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain("hoàn tiền");
    });

    it("rejects refund when no payment made → 422", async () => {
      mockOrderQuery({ total_paid: 0 });

      const res = await postRefund(ORDER_ID, { refund_mode: "full" });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toContain("chưa có thanh toán");
    });

    it("rejects refund for non-existent order → 404", async () => {
      supabaseSingleMock.mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });

      const res = await postRefund("non-existent", { refund_mode: "full" });
      expect(res.status).toBe(404);
    });
  });

  // ─── Data-Driven: Consumed Ratios ────────────────────────

  describe.each([
    {
      consumed: 0,
      total: 30,
      paid: 300000,
      expectedRefund: 300000,
      ratio: 0,
      label: "0/30 consumed → 100% refund",
    },
    {
      consumed: 15,
      total: 30,
      paid: 300000,
      expectedRefund: 150000,
      ratio: 0.5,
      label: "15/30 consumed → 50% refund",
    },
    {
      consumed: 29,
      total: 30,
      paid: 300000,
      expectedRefund: 10000,
      ratio: 0.9667,
      label: "29/30 consumed → ~3.3% refund",
    },
    {
      consumed: 30,
      total: 30,
      paid: 300000,
      expectedRefund: 0,
      ratio: 1,
      label: "30/30 consumed → 0% refund",
    },
    {
      consumed: 1,
      total: 365,
      paid: 365000,
      expectedRefund: 364000,
      ratio: 0.00274,
      label: "1/365 consumed → ~99.7% refund",
    },
  ])("Pro-rata scenario: $label", ({ consumed, total, paid, expectedRefund, ratio }) => {
    it(`→ refundable=${expectedRefund}`, async () => {
      mockOrderQuery({ total_paid: paid });
      vi.mocked(calculateRefund).mockReturnValue({
        refundableAmountVnd: expectedRefund,
        consumedRatio: ratio,
        notes: "Pro-rata",
      });

      const res = await postRefund(ORDER_ID, {
        refund_mode: "pro_rata",
        consumed_days: consumed,
        total_days: total,
      });

      expect(res.status).toBe(201);
      expect(calculateRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          paidAmountVnd: paid,
          consumedDays: consumed,
          totalDays: total,
        })
      );
    });
  });

  // ─── Defaults ────────────────────────────────────────────

  describe("Default values", () => {
    it("defaults refund_mode to pro_rata when not specified", async () => {
      mockOrderQuery({ total_paid: 200000 });
      vi.mocked(calculateRefund).mockReturnValue({
        refundableAmountVnd: 200000,
        consumedRatio: 0,
        notes: "Pro-rata",
      });

      await postRefund(ORDER_ID, {
        consumed_days: 0,
        total_days: 30,
      });

      expect(calculateRefund).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "pro_rata" })
      );
    });

    it("defaults total_days to 30 when not specified", async () => {
      mockOrderQuery({ total_paid: 100000 });
      vi.mocked(calculateRefund).mockReturnValue({
        refundableAmountVnd: 100000,
        consumedRatio: 0,
        notes: "Pro-rata",
      });

      await postRefund(ORDER_ID, {});

      expect(calculateRefund).toHaveBeenCalledWith(
        expect.objectContaining({ totalDays: 30 })
      );
    });
  });
});
