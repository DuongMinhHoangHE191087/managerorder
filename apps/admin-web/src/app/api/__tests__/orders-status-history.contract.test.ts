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
      createTestRequest("http://localhost/api/orders/00000000-0000-4000-8000-000000000061/status-history"),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000061" }) } as { params: Promise<{ id: string }> },
    );

    expect(response.status).toBe(404);
    expect(mockGetOrderById).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000061", TEST_ACCOUNT_ID);
    expect(mockGetOrderStatusHistory).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "Đơn hàng không tồn tại",
    });
  });

  it("returns the full history payload for an owned order", async () => {
    const history = [
      {
        id: "00000000-0000-4000-8000-000000000062",
        old_status: null,
        new_status: "pending_payment",
        changed_by: "Test User",
        change_reason: "Tạo đơn hàng mới",
      },
      {
        id: "00000000-0000-4000-8000-000000000063",
        old_status: "pending_payment",
        new_status: "active",
        changed_by: "Ops User",
        change_reason: "Kích hoạt sau thanh toán",
      },
    ];

    mockGetOrderById.mockResolvedValue({ id: "00000000-0000-4000-8000-00000000005b" });
    mockGetOrderStatusHistory.mockResolvedValue(history);

    const response = await GET(
      createTestRequest("http://localhost/api/orders/00000000-0000-4000-8000-00000000005b/status-history"),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-00000000005b" }) } as { params: Promise<{ id: string }> },
    );

    expect(response.status).toBe(200);
    expect(mockGetOrderById).toHaveBeenCalledWith("00000000-0000-4000-8000-00000000005b", TEST_ACCOUNT_ID);
    expect(mockGetOrderStatusHistory).toHaveBeenCalledWith("00000000-0000-4000-8000-00000000005b");
    expect(await response.json()).toEqual({ data: history });
  });
});
