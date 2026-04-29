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
vi.mock("@/lib/supabase/repositories/orders.repo", () => ({
  getOrderWithItems: vi.fn(),
}));
vi.mock("@/lib/supabase/repositories/activity-logs.repo", () => ({
  createActivityLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/repositories/order-status-history.repo", () => ({
  createOrderStatusHistory: vi.fn().mockResolvedValue(undefined),
}));

const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateChain = {
  eq: vi.fn(() => ({
    eq: vi.fn(() => updateEqMock),
  })),
};
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      update: vi.fn(() => updateChain),
    })),
  },
}));

import { resolveUser } from "@/lib/api/rbac";
import { getOrderWithItems } from "@/lib/supabase/repositories/orders.repo";
import { createOrderStatusHistory } from "@/lib/supabase/repositories/order-status-history.repo";
import { POST } from "@/app/api/orders/[id]/renew/route";

const ORDER_ID = "00000000-0000-4000-8000-0000000000a4";

function postRenew(id: string, body: unknown) {
  return POST(
    createTestRequest(`http://localhost/api/orders/${id}/renew`, {
      method: "POST",
      body,
    }),
    { params: Promise.resolve({ id }) } as any
  );
}

describe("POST /api/orders/[id]/renew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveUser).mockResolvedValue({
      userId: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      role: "admin_owner",
      accountId: TEST_ACCOUNT_ID,
      displayName: "Test Admin",
    } as any);
  });

  it("rejects renew when order status is not active or expired", async () => {
    vi.mocked(getOrderWithItems).mockResolvedValue({
      id: ORDER_ID,
      status: "draft",
      total_amount_vnd: 100000,
      total_paid: 0,
      customer_id: "00000000-0000-4000-8000-000000000033",
    } as any);

    const res = await postRenew(ORDER_ID, {
      durationMonths: 3,
      addAmountVnd: 50000,
      addPaidVnd: 50000,
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toContain("Không thể gia hạn");
  });

  it("activates expired orders when renewal is fully paid", async () => {
    vi.mocked(getOrderWithItems).mockResolvedValue({
      id: ORDER_ID,
      status: "expired",
      total_amount_vnd: 100000,
      total_paid: 100000,
      expires_at: "2025-01-01T00:00:00.000Z",
      customer_id: "00000000-0000-4000-8000-000000000033",
      sales_note: "Original note",
      proof_image_urls: [],
    } as any);

    const res = await postRenew(ORDER_ID, {
      durationMonths: 1,
      addAmountVnd: 50000,
      addPaidVnd: 50000,
      note: "Extend one month",
      proofUrls: ["https://example.com/proof.png"],
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(createOrderStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: ORDER_ID,
        old_status: "expired",
        new_status: "active",
      })
    );
  });
});
