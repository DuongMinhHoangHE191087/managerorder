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

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());
vi.mock("@/lib/api/rbac", () => mockResolveUser());
vi.mock("@/lib/services/allocation.service", () => ({
  deallocateOrder: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/refund-requests.repo", () => ({
  getRefundById: vi.fn(),
  updateRefundStatus: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/order-status-history.repo", () => ({
  createOrderStatusHistory: vi.fn().mockResolvedValue(undefined),
  getOrderStatusHistory: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));

const selectSingleMock = vi.fn();
const updatePayloads: Array<Record<string, unknown>> = [];
const updateFinalMock = vi.fn().mockResolvedValue({ error: null });
const ordersChain = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({ single: selectSingleMock })),
      single: selectSingleMock,
    })),
  })),
  update: vi.fn((payload: Record<string, unknown>) => {
    updatePayloads.push(payload);
    return {
      eq: vi.fn(() => ({
        eq: vi.fn(() => updateFinalMock),
      })),
    };
  }),
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ordersChain),
  },
}));

import { resolveUser } from "@/lib/api/rbac";
import { deallocateOrder } from "@/lib/services/allocation.service";
import { getRefundById, updateRefundStatus } from "@/lib/supabase/repositories/refund-requests.repo";
import { getOrderStatusHistory, createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { PATCH } from "@/app/api/orders/[id]/refunds/[refundId]/route";

const ORDER_ID = "00000000-0000-4000-8000-00000000009a";
const REFUND_ID = "00000000-0000-4000-8000-00000000009b";

function patchRefund(id: string, refundId: string, body: unknown) {
  return PATCH(
    createTestRequest(`http://localhost/api/orders/${id}/refunds/${refundId}`, {
      method: "PATCH",
      body,
    }),
    { params: Promise.resolve({ id, refundId }) } as any
  );
}

describe("PATCH /api/orders/[id]/refunds/[refundId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePayloads.length = 0;
    vi.mocked(resolveUser).mockResolvedValue({
      userId: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      role: "admin_owner",
      accountId: TEST_ACCOUNT_ID,
      displayName: "Test Admin",
    } as any);
  });

  it("deallocates inventory before marking the order refunded", async () => {
    let selectCall = 0;
    selectSingleMock.mockImplementation(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return Promise.resolve({
          data: { id: ORDER_ID, status: "expired" },
          error: null,
        });
      }
      return Promise.resolve({
        data: { total_paid: 100000 },
        error: null,
      });
    });

    vi.mocked(getRefundById).mockResolvedValue({
      id: REFUND_ID,
      order_id: ORDER_ID,
      customer_id: "00000000-0000-4000-8000-000000000033",
      refund_mode: "pro_rata",
      refundable_amount_vnd: 50000,
      status: "processing",
    } as any);
    vi.mocked(updateRefundStatus).mockResolvedValue({
      id: REFUND_ID,
      status: "completed",
    } as any);
    vi.mocked(getOrderStatusHistory).mockResolvedValue([]);
    vi.mocked(deallocateOrder).mockResolvedValue({ deallocatedSlots: 2, deallocatedKeys: 0 } as any);

    const res = await patchRefund(ORDER_ID, REFUND_ID, {
      status: "completed",
      admin_note: "OK",
    });

    expect(res.status).toBe(200);
    expect(deallocateOrder).toHaveBeenCalledWith(ORDER_ID, TEST_ACCOUNT_ID);
    expect(updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "refunded",
        total_paid: 50000,
      })
    );
    expect(updateRefundStatus).toHaveBeenCalledWith(
      REFUND_ID,
      "completed",
      expect.objectContaining({
        processed_by: TEST_USER_EMAIL,
      })
    );
    expect(createOrderStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        old_status: "expired",
        new_status: "refunded",
      })
    );
  });

  it("restores the previous order status when cancelling a completed refund", async () => {
    let selectCall = 0;
    selectSingleMock.mockImplementation(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return Promise.resolve({
          data: { id: ORDER_ID, status: "refunded" },
          error: null,
        });
      }
      return Promise.resolve({
        data: { total_paid: 100000 },
        error: null,
      });
    });

    vi.mocked(getRefundById).mockResolvedValue({
      id: REFUND_ID,
      order_id: ORDER_ID,
      customer_id: "00000000-0000-4000-8000-000000000033",
      refund_mode: "pro_rata",
      refundable_amount_vnd: 50000,
      status: "completed",
    } as any);
    vi.mocked(getOrderStatusHistory).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000071",
        order_id: ORDER_ID,
        old_status: "expired",
        new_status: "refunded",
        changed_by: TEST_USER_EMAIL,
        change_reason: "refund",
        metadata: {
          refund_id: REFUND_ID,
          previous_status: "expired",
          previous_total_paid: 150000,
        },
        created_at: "2025-01-01T00:00:00.000Z",
      } as any,
    ]);
    vi.mocked(updateRefundStatus).mockResolvedValue({
      id: REFUND_ID,
      status: "cancelled",
    } as any);

    const res = await patchRefund(ORDER_ID, REFUND_ID, {
      status: "cancelled",
      admin_note: "Cancel refund",
    });

    expect(res.status).toBe(200);
    expect(deallocateOrder).not.toHaveBeenCalled();
    expect(updatePayloads[0]).toEqual(
      expect.objectContaining({
        status: "expired",
        total_paid: 150000,
      })
    );
    expect(updateRefundStatus).toHaveBeenCalledWith(
      REFUND_ID,
      "cancelled",
      expect.objectContaining({
        processed_by: TEST_USER_EMAIL,
      })
    );
    expect(createOrderStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        old_status: "refunded",
        new_status: "expired",
      })
    );
  });
});
