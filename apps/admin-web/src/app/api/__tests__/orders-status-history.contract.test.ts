import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TEST_ACCOUNT_ID,
  createTestRequest,
  mockWithAccount,
  mockWithErrorHandler,
} from "./helpers/setup";

vi.mock("@/lib/api/with-account", () => mockWithAccount());
vi.mock("@/lib/api/with-error-handler", () => mockWithErrorHandler());

const mockGetOrderById = vi.fn();
const mockGetOrderStatusHistory = vi.fn();

vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  getOrderById: (...args: unknown[]) => mockGetOrderById(...args),
}));

vi.mock("@/lib/supabase/repositories/order-status-history.repo", () => ({
  getOrderStatusHistory: (...args: unknown[]) => mockGetOrderStatusHistory(...args),
}));

import { GET } from "@/app/api/orders/[id]/status-history/route";

describe("GET /api/orders/[id]/status-history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when the order does not belong to the current account", async () => {
    mockGetOrderById.mockResolvedValue(null);

    const response = await GET(
      createTestRequest("http://localhost/api/orders/order-404/status-history"),
      { params: Promise.resolve({ id: "order-404" }) } as { params: Promise<{ id: string }> },
    );

    expect(response.status).toBe(404);
    expect(mockGetOrderById).toHaveBeenCalledWith("order-404", TEST_ACCOUNT_ID);
    expect(mockGetOrderStatusHistory).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "Đơn hàng không tồn tại",
    });
  });

  it("returns the full history payload for an owned order", async () => {
    const history = [
      {
        id: "history-1",
        old_status: null,
        new_status: "pending_payment",
        changed_by: "Test User",
        change_reason: "Tạo đơn hàng mới",
      },
      {
        id: "history-2",
        old_status: "pending_payment",
        new_status: "active",
        changed_by: "Ops User",
        change_reason: "Kích hoạt sau thanh toán",
      },
    ];

    mockGetOrderById.mockResolvedValue({ id: "order-1" });
    mockGetOrderStatusHistory.mockResolvedValue(history);

    const response = await GET(
      createTestRequest("http://localhost/api/orders/order-1/status-history"),
      { params: Promise.resolve({ id: "order-1" }) } as { params: Promise<{ id: string }> },
    );

    expect(response.status).toBe(200);
    expect(mockGetOrderById).toHaveBeenCalledWith("order-1", TEST_ACCOUNT_ID);
    expect(mockGetOrderStatusHistory).toHaveBeenCalledWith("order-1");
    expect(await response.json()).toEqual({ data: history });
  });
});
