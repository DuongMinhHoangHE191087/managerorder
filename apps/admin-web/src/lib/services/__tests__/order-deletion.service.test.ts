import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNT_ID } from "@/app/api/__tests__/helpers/setup";

vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  deleteOrder: vi.fn(),
  getOrderWithItems: vi.fn(),
}));
vi.mock("@/lib/services/allocation.service", () => ({
  deallocateOrder: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn(),
}));

import { batchDeleteOrdersWithAudit, deleteOrderWithAudit } from "@/lib/services/order-deletion.service";
import { deleteOrder, getOrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import { deallocateOrder } from "@/lib/services/allocation.service";
import { createActivityLog } from "@/lib/supabase/repositories/activity-logs.repo";

const actor = {
  email: "test-user@local",
  displayName: "Test User",
};

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    customer_id: "customer-1",
    status: "paid",
    total_amount_vnd: 120000,
    total_paid: 60000,
    expires_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("order-deletion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mirrors single delete side effects", async () => {
    vi.mocked(getOrderWithItems).mockResolvedValue(makeOrder() as any);
    vi.mocked(deallocateOrder).mockResolvedValue({ deallocatedSlots: 1, deallocatedKeys: 0 } as any);
    vi.mocked(deleteOrder).mockResolvedValue(undefined as any);
    vi.mocked(createActivityLog).mockResolvedValue(null);

    const result = await deleteOrderWithAudit("order-1", TEST_ACCOUNT_ID, actor);

    expect(result).toBe(true);
    expect(deallocateOrder).toHaveBeenCalledWith("order-1", TEST_ACCOUNT_ID);
    expect(deleteOrder).toHaveBeenCalledWith("order-1", TEST_ACCOUNT_ID);
    expect(createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: TEST_ACCOUNT_ID,
        action_type: "ORDER_DELETED",
        customer_id: "customer-1",
        order_id: "order-1",
        created_by: "Test User",
      }),
    );
  });

  it("processes batches sequentially and skips missing orders", async () => {
    vi.mocked(getOrderWithItems)
      .mockResolvedValueOnce(makeOrder({ customer_id: "customer-a" }) as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeOrder({ customer_id: "customer-c" }) as any);
    vi.mocked(deallocateOrder).mockResolvedValue({ deallocatedSlots: 0, deallocatedKeys: 0 } as any);
    vi.mocked(deleteOrder).mockResolvedValue(undefined as any);
    vi.mocked(createActivityLog).mockResolvedValue(null);

    const deletedCount = await batchDeleteOrdersWithAudit(
      ["order-1", "order-2", "order-3"],
      TEST_ACCOUNT_ID,
      actor,
    );

    expect(deletedCount).toBe(2);
    expect(getOrderWithItems).toHaveBeenCalledTimes(3);
    expect(deallocateOrder).toHaveBeenCalledTimes(2);
    expect(deleteOrder).toHaveBeenCalledTimes(2);
    expect(createActivityLog).toHaveBeenCalledTimes(2);
  });
});
